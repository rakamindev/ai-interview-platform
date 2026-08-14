# frozen_string_literal: true

module Portfolios
  # N10: Generates a structured skill portfolio from the full transcript
  # and final coverage map using Gemini Pro.
  # Runs post-session as a background job.
  class Generator
    def initialize(session:, gemini_client: nil)
      @session = session
      @gemini_client = gemini_client || Gemini::HttpClient.new(
        model:   ENV.fetch('GEMINI_PRO_MODEL', 'gemini-2.0-pro-001'),
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

    NOT_ASSESSED_SUMMARY = 'This skill was configured for the assessment but was not covered during ' \
                           'the interview — no probing occurred, so no evidence was collected.'
    UNPARSEABLE_SUMMARY  = 'The assessment model returned a response for this skill in an unexpected ' \
                           'format and it could not be scored automatically. Needs manual review.'
    NO_SUMMARY_FALLBACK  = 'No summary was provided.'

    def save_skills(portfolio, response)
      data = response.is_a?(Hash) ? response : JSON.parse(response)
      configured_data = Array(data['configured_skills'])
      discovered_data = Array(data['discovered_skills'])

      # Destroy existing skills (idempotent regeneration)
      portfolio.portfolio_skills.destroy_all

      # Iterate the assessment's OWN configured skill list, not just whatever
      # Gemini happened to return — a skill the interview never got to must
      # still show up, explicitly marked not_assessed, instead of silently
      # disappearing. See assessment/gap-analysis.md P0-4.
      @session.assessment.assessment_skills.order(:display_order).each do |skill|
        matched = configured_data.find { |sd| skill_data_matches?(sd, skill) }

        portfolio.portfolio_skills.create!(
          skill_id:      skill.skill_id,
          skill_label:   skill.skill_label,
          is_discovered: false,
          **outcome_attrs(matched)
        )
      end

      discovered_data.each do |skill_data|
        portfolio.portfolio_skills.create!(
          skill_id:      nil,
          skill_label:   skill_data['skill_label'],
          is_discovered: true,
          **outcome_attrs(skill_data)
        )
      end
    end

    def skill_data_matches?(skill_data, assessment_skill)
      return false if skill_data.nil?

      by_id = assessment_skill.skill_id.presence && skill_data['skill_id'] == assessment_skill.skill_id
      by_label = skill_data['skill_label'].to_s.strip.casecmp?(assessment_skill.skill_label.to_s.strip)

      by_id || by_label
    end

    # Never assessed (Gemini has nothing for this skill at all) vs
    # unparseable (Gemini has an entry but we can't extract a valid level
    # from it) are kept distinct — the first is a real "not covered"
    # signal, the second is a data-quality problem worth flagging for
    # manual review rather than silently scoring either one.
    def outcome_attrs(skill_data)
      return not_assessed_attrs if skill_data.nil?

      level = parse_level(skill_data['level'])
      return unparseable_attrs(skill_data) if level.nil?

      assessed_attrs(skill_data, level)
    end

    def assessed_attrs(skill_data, level)
      confidence = skill_data['confidence']
      confidence = 'low' unless PortfolioSkill::CONFIDENCE_LEVELS.include?(confidence)

      {
        status:             'assessed',
        ai_level:           level,
        ai_confidence:      confidence,
        evidence:           Array(skill_data['evidence']).first(3),
        competency_summary: skill_data['competency_summary'].presence || NO_SUMMARY_FALLBACK
      }
    end

    def not_assessed_attrs
      {
        status:             'not_assessed',
        ai_level:           nil,
        ai_confidence:      nil,
        evidence:           [],
        competency_summary: NOT_ASSESSED_SUMMARY
      }
    end

    def unparseable_attrs(skill_data)
      {
        status:             'unparseable',
        ai_level:           nil,
        ai_confidence:      nil,
        evidence:           Array(skill_data['evidence']).first(3),
        competency_summary: skill_data['competency_summary'].presence || UNPARSEABLE_SUMMARY
      }
    end

    # Accepts an Integer directly, or extracts the first run of digits from a
    # string (Gemini occasionally returns "3 (Intermediate)" instead of a
    # bare number). Returns nil — never a default score — when no level can
    # be determined at all, so the caller can mark the skill unparseable
    # instead of silently recording it as the lowest possible level.
    def parse_level(raw)
      return raw.clamp(1, 5) if raw.is_a?(Integer)
      return nil unless raw.is_a?(String)

      digits = raw[/\d+/]
      digits&.to_i&.clamp(1, 5)
    end
  end
end
