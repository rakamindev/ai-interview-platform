# frozen_string_literal: true

module Portfolios
  # N10: Generates a structured skill portfolio from the full transcript
  # and final coverage map using Gemini Pro.
  # Runs post-session as a background job.
  #
  # Hardening:
  #  - Invalid/missing AI levels become nil ("not assessed"), NEVER coerced to L1.
  #  - Evidence quotes are verified against candidate transcript turns; each quote
  #    stores provenance (turn id/number, verification status). Untraceable quotes
  #    are dropped and the evaluation flagged for review.
  #  - Every configured skill omitted from a partial model response still gets a
  #    visible "not assessed" evaluation.
  class Generator
    def initialize(session:, gemini_client: nil)
      @session = session
      @gemini_client = gemini_client || Gemini::HttpClient.new(
        model:   ENV.fetch('GEMINI_PRO_MODEL', 'gemini-3.5-flash'),
        timeout: 180  # up to 3 minutes for large transcripts
      )
    end

    # Returns the Portfolio record with skills populated.
    def call
      portfolio = @session.portfolio || @session.create_portfolio!(
        candidate_id:      @session.candidate_id,
        generation_status: 'pending'
      )

      portfolio.update!(generation_status: 'generating')

      prompt   = build_prompt
      response = @gemini_client.generate_content(prompt, temperature: 0.2)

      save_skills(portfolio, response)
      portfolio.update!(generation_status: 'complete', generated_at: Time.current)

      Rails.logger.info("[N10] Portfolio generated for session #{@session.id}")
      portfolio
    rescue => e
      portfolio&.update!(generation_status: 'failed', generation_error: e.message)
      Rails.logger.error("[N10] Portfolio generation failed for session #{@session.id}: #{e.class} #{e.message}")
      raise
    end

    private

    def build_prompt
      assessment       = @session.assessment
      configured_skills = assessment.assessment_skills.order(:display_order)
      coverage_maps     = @session.coverage_maps.order(:id)
      turns             = @session.transcript_turns.ordered

      skills_text = configured_skills.map { |s| skill_definition_block(s) }.join("\n\n")

      coverage_json = {
        skills:     coverage_maps.reject(&:is_discovered).map { |m| coverage_json(m) },
        discovered: coverage_maps.select(&:is_discovered).map { |m| coverage_json(m) }
      }.to_json

      transcript_text = turns.map { |t| "[#{t.speaker.upcase}]: #{t.text}" }.join("\n")

      <<~PROMPT
        You are evaluating a completed skills assessment interview to produce a structured skill portfolio.

        ROLE BEING ASSESSED: #{assessment.name}

        SKILL DEFINITIONS AND BEHAVIORAL ANCHORS:
        #{skills_text}

        UNIVERSAL L1-L5 ANCHORS (use for discovered skills):
        L1 — Executes with explicit guidance and close review. Understands conceptually but cannot apply independently.
        L2 — Executes independently on routine scope. Uses known patterns. Handles common cases but not edge cases.
        L3 — Executes complex, ambiguous scope. Makes tradeoffs. Handles edge cases. Can teach L1-L2.
        L4 — Defines standards and creates reusable systems. Resolves systemic problems. Cross-team impact.
        L5 — Org-level authority. Shapes how the skill is practiced. Rare.

        FINAL COVERAGE MAP:
        #{coverage_json}

        FULL INTERVIEW TRANSCRIPT:
        #{transcript_text}

        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        TASK
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

        For EACH skill in the coverage map (both configured and discovered):

        1. FIND THE EVIDENCE
           Read all transcript turns where this skill was discussed.
           Identify 2-3 of the most revealing EXACT QUOTES from the CANDIDATE (not the AI).
           IMPORTANT: Each quote MUST be copied VERBATIM from the candidate's transcript turns above.
           Do not paraphrase, translate, or invent quotes. If the transcript is in another language, quote it in that language.
           If the candidate said little or nothing relevant, provide fewer quotes or an empty array.

        2. ASSIGN A LEVEL
           Compare the candidate's actual behavior to the L1-L5 anchors.
           Assign the highest level where you see CONSISTENT evidence, not just one strong moment.
           If evidence is mixed (mostly L2 with one L3 moment), assign L2.
           If there is INSUFFICIENT signal to rate this skill, OMIT the "level" field entirely or set it to null.
           Never invent a level without evidence.

        3. WRITE THE COMPETENCY SUMMARY
           2-3 sentences. Focus on patterns, not individual answers.

        4. ASSIGN CONFIDENCE
           high — probe_count >= 3 AND state = covered
           medium — probe_count = 2 OR state = partial
           low — probe_count <= 1 OR state = initiated

        OUTPUT (JSON only, no prose):
        {
          "configured_skills": [
            {
              "skill_id": "sk-eng-001",
              "skill_label": "React / Frontend Development",
              "level": 3,
              "confidence": "high",
              "evidence": ["exact verbatim quote 1", "exact verbatim quote 2"],
              "competency_summary": "2-3 sentence summary"
            }
          ],
          "discovered_skills": [
            {
              "skill_label": "Micro-frontend Architecture",
              "level": 2,
              "confidence": "low",
              "evidence": ["exact verbatim quote 1"],
              "competency_summary": "2-3 sentence summary"
            }
          ]
        }
      PROMPT
    end

    def skill_definition_block(skill)
      lines = ["━━━━━━━━━━━━━━━"]
      lines << "SKILL: #{skill.skill_label} (#{skill.skill_id || 'custom'})"
      lines << "SCOPE: #{skill.scope_include}" if skill.scope_include.present?
      lines << ""
      lines << "L1 — #{skill.l1_anchor}"
      lines << "L2 — #{skill.l2_anchor}"
      lines << "L3 — #{skill.l3_anchor}"
      lines << "L4 — #{skill.l4_anchor}"
      lines << "L5 — #{skill.l5_anchor}"
      lines.join("\n")
    end

    def coverage_json(map)
      {
        id:          map.skill_id || map.skill_label.downcase.gsub(/\s+/, '-'),
        label:       map.skill_label,
        state:       map.state,
        probe_count: map.probe_count,
        is_discovered: map.is_discovered
      }
    end

    def save_skills(portfolio, response)
      data = response.is_a?(Hash) ? response : JSON.parse(response)

      # Destroy existing skills (idempotent regeneration)
      portfolio.portfolio_skills.destroy_all

      candidate_turns = @session.transcript_turns.where(speaker: 'candidate').order(:turn_number).to_a
      coverage_by_key  = coverage_lookup

      parsed_configured = Array(data['configured_skills'])
      parsed_discovered = Array(data['discovered_skills'])

      parsed_configured.each do |skill_data|
        create_skill(portfolio, skill_data, is_discovered: false, candidate_turns: candidate_turns, coverage_by_key: coverage_by_key)
      end

      parsed_discovered.each do |skill_data|
        create_skill(portfolio, skill_data, is_discovered: true, candidate_turns: candidate_turns, coverage_by_key: coverage_by_key)
      end

      # Partial output protection: every configured skill in the assessment that
      # Gemini omitted entirely still gets a visible "not assessed" evaluation.
      # Match by skill_id OR label (custom skills have nil skill_id).
      covered_ids   = parsed_configured.map { |s| s['skill_id'] }.compact
      covered_labels = parsed_configured.map { |s| normalize(s['skill_label']) }.compact
      @session.assessment.assessment_skills.order(:display_order).each do |assessment_skill|
        covered = covered_ids.include?(assessment_skill.skill_id) ||
                  covered_labels.include?(normalize(assessment_skill.skill_label))
        next if covered

        portfolio.portfolio_skills.create!(
          skill_id:           assessment_skill.skill_id,
          skill_label:        assessment_skill.skill_label,
          is_discovered:      false,
          ai_level:           nil,
          ai_confidence:      nil,
          evidence:           [],
          evidence_provenance: [],
          competency_summary: "Not assessed — the AI model produced no evaluation for this skill."
        )
      end
    end

    def create_skill(portfolio, skill_data, is_discovered:, candidate_turns:, coverage_by_key:)
      evidence_quotes = Array(skill_data['evidence']).first(3).map(&:to_s)
      provenance      = verify_evidence(evidence_quotes, candidate_turns)
      coverage        = find_coverage(coverage_by_key, skill_data, is_discovered)
      confidence      = Coverage::ConfidenceCalculator.call(
        state:       coverage&.state,
        probe_count: coverage&.probe_count
      )

      portfolio.portfolio_skills.create!(
        skill_id:            skill_data['skill_id'],
        skill_label:         skill_data['skill_label'].presence || "Unknown skill",
        is_discovered:       is_discovered,
        ai_level:            parse_level(skill_data['level']),
        ai_confidence:       confidence,
        evidence:            evidence_quotes,
        evidence_provenance: provenance,
        competency_summary:  skill_data['competency_summary'].presence || "No summary provided."
      )
    end

    # Coverage map keyed by skill_id and normalized label for lookup.
    def coverage_lookup
      @session.coverage_maps.index_by do |m|
        [m.skill_id, normalize(m.skill_label)]
      end
    end

    def find_coverage(coverage_by_key, skill_data, is_discovered)
      key = skill_data['skill_id']
      coverage_by_key[[key, nil]] || coverage_by_key[[nil, normalize(skill_data['skill_label'])]]
    end

    # Strict level parsing: only an integer 1..5 is a valid AI level.
    # Anything else (null, "unknown", arrays, out-of-range) → nil (not assessed).
    def parse_level(raw)
      return nil unless raw.is_a?(Integer) || raw.is_a?(String) && raw.match?(/\A\d+\z/)

      value = raw.to_i
      value.between?(1, 5) ? value : nil
    end

    # Verifies each evidence quote against candidate transcript turns.
    # Returns provenance entries: [{ quote_index, transcript_turn_id, turn_number, verified }]
    def verify_evidence(quotes, candidate_turns)
      quotes.each_with_index.map do |quote, idx|
        turn = find_matching_turn(quote, candidate_turns)
        if turn
          {
            'quote_index'      => idx,
            'transcript_turn_id' => turn.id,
            'turn_number'      => turn.turn_number,
            'verified'         => true
          }
        else
          {
            'quote_index'      => idx,
            'transcript_turn_id' => nil,
            'turn_number'      => nil,
            'verified'         => false
          }
        end
      end
    end

    def find_matching_turn(quote, candidate_turns)
      normalized_quote = normalize(quote)
      return nil if normalized_quote.length < 10

      candidate_turns.find do |turn|
        normalized_turn = normalize(turn.text)
        normalized_turn.include?(normalized_quote)
      end
    end

    def normalize(text)
      text.to_s.downcase.gsub(/[^a-z0-9\s]/, '').gsub(/\s+/, ' ').strip
    end
  end
end
