# frozen_string_literal: true

module Portfolios
  # N10: Generates a structured skill portfolio from the full transcript
  # and final coverage map using Gemini Pro.
  # Runs post-session as a background job.
  class Generator
    def initialize(session:, gemini_client: nil)
      @session = session
      @gemini_client = gemini_client || Gemini::HttpClient.new(
        model:   ENV.fetch('GEMINI_PRO_MODELS', ENV.fetch('GEMINI_PRO_MODEL', 'gemini-2.0-pro-001')),
        timeout: 180  # up to 3 minutes for large transcripts
      )
    end

    # Returns the Portfolio record with skills populated.
    def call
      portfolio = @session.portfolio || @session.create_portfolio!(
        candidate_id:      @session.candidate_id,
        generation_status: 'pending'
      )

      PortfolioRevision.capture!(portfolio) if portfolio.complete? || portfolio.portfolio_skills.exists?

      portfolio.update!(generation_status: 'generating')

      candidate_turns = @session.transcript_turns.ordered.select { |turn| turn.speaker == 'candidate' }

      if candidate_turns.empty?
        save_baseline_skills(portfolio)
      else
        prompt   = build_prompt
        response = @gemini_client.generate_content(prompt, temperature: 0.2)
        save_skills(portfolio, response, candidate_turns)
      end

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
           Identify the 2-3 most revealing quotes from the CANDIDATE (not the AI).
           A quote is revealing if it shows HOW they think, not just WHAT they know.

        2. ASSIGN A LEVEL
           Compare the candidate's actual behavior to the L1-L5 anchors.
           Assign the highest level where you see CONSISTENT evidence, not just one strong moment.
           If evidence is mixed (mostly L2 with one L3 moment), assign L2.

        3. WRITE THE COMPETENCY SUMMARY
           2-3 sentences. Focus on patterns, not individual answers.
           What does this person reliably do at this skill? What's the ceiling? What's missing?

        4. ASSIGN CONFIDENCE
           high — probe_count >= 3 AND state = covered
           medium — probe_count = 2 OR state = partial
           low — probe_count <= 1 OR state = initiated

        STRICT EVIDENCE RULES:
        - Use only facts explicitly stated by the CANDIDATE in the transcript.
        - Never infer experience from the role, skill definitions, AI questions, or silence.
        - If no candidate evidence supports a configured skill, assign L1, confidence low, evidence [], and state that there was insufficient evidence.
        - Do not create discovered skills unless the candidate explicitly demonstrated them.

        OUTPUT (JSON only, no prose):
        {
          "configured_skills": [
            {
              "skill_id": "sk-eng-001",
              "skill_label": "React / Frontend Development",
              "level": 3,
              "confidence": "high",
              "evidence": ["quote 1", "quote 2", "quote 3"],
              "competency_summary": "2-3 sentence summary"
            }
          ],
          "discovered_skills": [
            {
              "skill_label": "Micro-frontend Architecture",
              "level": 2,
              "confidence": "low",
              "evidence": ["quote 1"],
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

    def save_baseline_skills(portfolio)
      preserved_overrides = capture_overrides(portfolio)
      portfolio.portfolio_skills.destroy_all

      @session.assessment.assessment_skills.order(:display_order).each do |skill|
        portfolio_skill = portfolio.portfolio_skills.create!(
          skill_id:           skill.skill_id,
          skill_label:        skill.skill_label,
          is_discovered:      false,
          ai_level:           1,
          ai_confidence:      'low',
          evidence:           [],
          competency_summary: 'No candidate responses were recorded, so proficiency could not be demonstrated.'
        )
        restore_override(portfolio_skill, preserved_overrides)
      end
    end

    def save_skills(portfolio, response, candidate_turns)
      data = response.is_a?(Hash) ? response : JSON.parse(response)
      candidate_text = candidate_turns.map(&:text).join(' ')

      preserved_overrides = capture_overrides(portfolio)

      # Destroy existing skills (idempotent regeneration)
      portfolio.portfolio_skills.destroy_all

      (data['configured_skills'] || []).each do |skill_data|
        evidence = valid_evidence(skill_data['evidence'], candidate_text)
        portfolio_skill = portfolio.portfolio_skills.create!(
          skill_id:           skill_data['skill_id'],
          skill_label:        skill_data['skill_label'],
          is_discovered:      false,
          ai_level:           evidence.empty? ? 1 : skill_data['level'].to_i.clamp(1, 5),
          ai_confidence:      evidence.empty? ? 'low' : skill_data['confidence'],
          evidence:           evidence,
          competency_summary: evidence.empty? ? insufficient_evidence_summary : skill_data['competency_summary']
        )
        restore_override(portfolio_skill, preserved_overrides)
      end

      (data['discovered_skills'] || []).each do |skill_data|
        evidence = valid_evidence(skill_data['evidence'], candidate_text)
        next if evidence.empty?

        portfolio.portfolio_skills.create!(
          skill_id:           nil,
          skill_label:        skill_data['skill_label'],
          is_discovered:      true,
          ai_level:           skill_data['level'].to_i.clamp(1, 5),
          ai_confidence:      skill_data['confidence'],
          evidence:           evidence,
          competency_summary: skill_data['competency_summary']
        )
      end
    end

    def capture_overrides(portfolio)
      portfolio.portfolio_skills.includes(:assessor_override).each_with_object({}) do |skill, overrides|
        override = skill.assessor_override
        next unless override && override.override_level != skill.ai_level

        key = skill.skill_id.present? ? "skill:#{skill.skill_id}" : "label:#{skill.skill_label}"
        overrides[key] = {
          override_level: override.override_level,
          assessor_notes: override.assessor_notes,
          overridden_by:  override.overridden_by,
          overridden_at:  override.overridden_at
        }
      end
    end

    def restore_override(portfolio_skill, preserved_overrides)
      key = portfolio_skill.skill_id.present? ? "skill:#{portfolio_skill.skill_id}" : "label:#{portfolio_skill.skill_label}"
      attributes = preserved_overrides[key]
      return unless attributes

      portfolio_skill.create_assessor_override!(attributes.merge(ai_level: portfolio_skill.ai_level))
    end

    def valid_evidence(evidence, candidate_text)
      normalized_candidate_text = normalize_evidence(candidate_text)

      Array(evidence).filter_map do |quote|
        next unless quote.present?

        normalized_quote = normalize_evidence(quote)
        next if normalized_quote.length < 8
        next unless normalized_candidate_text.include?(normalized_quote)

        quote.to_s
      end.first(3)
    end

    def normalize_evidence(text)
      text.to_s.downcase.gsub(/[^\p{L}\p{N}\s]/, ' ').gsub(/\s+/, ' ').strip
    end

    def insufficient_evidence_summary
      'Insufficient directly attributable candidate evidence was recorded for this skill.'
    end
  end
end
