# frozen_string_literal: true

module Portfolios
  class Generator
    STALE_AFTER = 15.minutes

    UNIVERSAL_ANCHORS = <<~TEXT
      L1 — Executes with explicit guidance and close review. Understands conceptually but cannot apply independently.
      L2 — Executes independently on routine scope. Uses known patterns. Handles common cases but not edge cases.
      L3 — Executes complex, ambiguous scope. Makes tradeoffs. Handles edge cases. Can teach L1-L2.
      L4 — Defines standards and creates reusable systems. Resolves systemic problems. Cross-team impact.
      L5 — Org-level authority. Shapes how the skill is practiced. Rare.
    TEXT

    def initialize(session:, gemini_client: nil)
      @session = session
      @gemini_client = gemini_client
    end

    def call
      portfolio = @session.portfolio || @session.create_portfolio!(
        candidate_id:      @session.candidate_id,
        generation_status: 'pending'
      )

      unless claim(portfolio)
        Rails.logger.info("[N10] Portfolio for session #{@session.id} is already generated or in progress, skipping")
        return portfolio
      end

      rows = skill_rows

      Portfolio.transaction do
        portfolio.portfolio_skills.destroy_all
        rows.each { |row| portfolio.portfolio_skills.create!(row) }
        portfolio.update!(generation_status: 'complete', generated_at: Time.current, generation_error: nil)
      end

      Rails.logger.info("[N10] Portfolio generated for session #{@session.id}")
      portfolio
    rescue StandardError => e
      portfolio&.update!(generation_status: 'failed', generation_error: safe_error_message(e))
      Rails.logger.error("[N10] Portfolio generation failed for session #{@session.id}: #{e.class}")
      raise
    end

    private

    def claim(portfolio)
      claimable = Portfolio.where(id: portfolio.id).where(
        "generation_status IN ('pending', 'failed') OR (generation_status = 'generating' AND generation_started_at < ?)",
        STALE_AFTER.ago
      )

      return false unless claimable.update_all(generation_status: 'generating', generation_started_at: Time.current) == 1

      portfolio.reload
      true
    end

    def skill_rows
      maps = @session.coverage_maps.order(:id).to_a.reject { |map| map.is_discovered && map.state == 'not_yet' }
      ratings = rate(maps.reject { |map| map.state == 'not_yet' })

      maps.map { |map| row_for(map, ratings[ResponseParser.normalize_label(map.skill_label)]) } +
        skills_without_coverage(maps).map { |skill| not_assessed_row(skill.skill_id, skill.skill_label) }
    end

    def rate(discussed_maps)
      return {} if discussed_maps.empty?

      response = gemini_client.generate_content(build_prompt(discussed_maps), temperature: 0.2)
      ResponseParser.new(response).ratings_by_label
    end

    def row_for(map, rating)
      return not_assessed_row(map.skill_id, map.skill_label, discovered: map.is_discovered) if map.state == 'not_yet'

      row = {
        skill_id:           map.skill_id,
        skill_label:        map.skill_label,
        is_discovered:      map.is_discovered,
        evidence:           rating ? rating[:evidence] : [],
        competency_summary: rating&.dig(:competency_summary)
      }

      if rating&.dig(:level)
        row.merge(assessment_status: 'assessed', ai_level: rating[:level], ai_confidence: Confidence.for(map))
      else
        row.merge(assessment_status: 'insufficient_evidence', ai_level: nil, ai_confidence: nil)
      end
    end

    def not_assessed_row(skill_id, skill_label, discovered: false)
      {
        skill_id:           skill_id,
        skill_label:        skill_label,
        is_discovered:      discovered,
        assessment_status:  'not_assessed',
        ai_level:           nil,
        ai_confidence:      nil,
        evidence:           [],
        competency_summary: nil
      }
    end

    def skills_without_coverage(maps)
      covered_labels = maps.map { |map| ResponseParser.normalize_label(map.skill_label) }

      @session.assessment.assessment_skills.order(:display_order).reject do |skill|
        covered_labels.include?(ResponseParser.normalize_label(skill.skill_label))
      end
    end

    def gemini_client
      @gemini_client ||= Gemini::HttpClient.new(
        model:   ENV.fetch('GEMINI_PRO_MODEL', 'gemini-2.0-pro-001'),
        timeout: 180
      )
    end

    def safe_error_message(error)
      case error
      when Gemini::HttpClient::TimeoutError   then 'The AI model timed out'
      when Gemini::HttpClient::RateLimitError then 'The AI model is rate limited'
      when Gemini::HttpClient::ApiError       then 'The AI model request failed'
      when ResponseParser::InvalidResponse    then error.message
      else 'Unexpected error while generating the portfolio'
      end
    end

    def build_prompt(discussed_maps)
      assessment = @session.assessment
      definitions = assessment.assessment_skills.order(:display_order).map { |skill| skill_definition_block(skill) }
      skills_json = discussed_maps.map do |map|
        { skill_label: map.skill_label, discovered: map.is_discovered, state: map.state, probe_count: map.probe_count }
      end
      transcript = @session.transcript_turns.ordered.map { |turn| "[#{turn.speaker.upcase}]: #{turn.text}" }.join("\n")

      <<~PROMPT
        You are evaluating a completed skills assessment interview to produce a structured skill portfolio.

        ROLE BEING ASSESSED: #{assessment.name}

        SKILL DEFINITIONS AND BEHAVIORAL ANCHORS:
        #{definitions.join("\n\n")}

        UNIVERSAL L1-L5 ANCHORS (use for discovered skills):
        #{UNIVERSAL_ANCHORS}
        SKILLS TO RATE:
        #{skills_json.to_json}

        FULL INTERVIEW TRANSCRIPT:
        #{transcript}

        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        TASK
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

        Rate ONLY the skills listed in SKILLS TO RATE. Use each skill_label exactly as written.

        1. FIND THE EVIDENCE
           Identify the 2-3 most revealing quotes from the CANDIDATE (not the AI).
           A quote is revealing if it shows HOW they think, not just WHAT they know.

        2. ASSIGN A LEVEL
           Assign the highest level where you see CONSISTENT evidence, not just one strong moment.
           If evidence is mixed (mostly L2 with one L3 moment), assign L2.
           If the transcript does not contain enough evidence to defend a level, set "level" to null.
           Never guess a low level because evidence is missing. Missing evidence is not weak evidence.

        3. WRITE THE COMPETENCY SUMMARY
           2-3 sentences. Focus on patterns, not individual answers.
           If level is null, explain what was discussed and what is still unknown.

        OUTPUT (JSON only, no prose):
        {
          "skills": [
            {
              "skill_label": "React / Frontend Development",
              "level": 3,
              "evidence": ["quote 1", "quote 2"],
              "competency_summary": "2-3 sentence summary"
            }
          ]
        }
      PROMPT
    end

    def skill_definition_block(skill)
      lines = ['━━━━━━━━━━━━━━━']
      lines << "SKILL: #{skill.skill_label} (#{skill.skill_id || 'custom'})"
      lines << "SCOPE: #{skill.scope_include}" if skill.scope_include.present?
      lines << ''
      lines << "L1 — #{skill.l1_anchor}"
      lines << "L2 — #{skill.l2_anchor}"
      lines << "L3 — #{skill.l3_anchor}"
      lines << "L4 — #{skill.l4_anchor}"
      lines << "L5 — #{skill.l5_anchor}"
      lines.join("\n")
    end
  end
end
