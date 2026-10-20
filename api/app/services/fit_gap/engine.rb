# frozen_string_literal: true

module FitGap
  # N13: Generates a fit/gap report comparing a portfolio against a vacancy.
  # Uses rule-based comparison for skill levels + Gemini Flash for culture narrative.
  class Engine
    NOT_ASSESSED_REASONS = {
      'not_assessed'          => 'not_covered',
      'insufficient_evidence' => 'insufficient_evidence'
    }.freeze

    def initialize(portfolio:, vacancy:, gemini_client: nil)
      @portfolio = portfolio
      @vacancy   = vacancy
      @gemini_client = gemini_client || Gemini::HttpClient.new(
        model:   ENV.fetch('GEMINI_FLASH_MODEL', 'gemini-2.0-flash-001'),
        timeout: 30
      )
    end

    def call
      skill_comparisons = build_skill_comparisons
      narratives        = generate_narratives(skill_comparisons)

      FitGapReport.upsert(
        {
          portfolio_id:      @portfolio.id,
          vacancy_id:        @vacancy.id,
          skill_comparisons: skill_comparisons,
          culture_narrative: narratives[:culture],
          overall_narrative: narratives[:overall],
          generated_at:      Time.current
        },
        unique_by: %i[portfolio_id vacancy_id]
      )

      Rails.logger.info("[N13] Fit/gap report generated: portfolio=#{@portfolio.id} vacancy=#{@vacancy.id}")
      FitGapReport.find_by!(portfolio_id: @portfolio.id, vacancy_id: @vacancy.id)
    end

    private

    def build_skill_comparisons
      portfolio_skills = effective_portfolio_skills

      @vacancy.vacancy_skills.map do |vacancy_skill|
        portfolio_skill = find_portfolio_skill(portfolio_skills, vacancy_skill.skill_label, vacancy_skill.skill_id)
        candidate_level = portfolio_skill&.dig(:effective_level)
        expected_level  = vacancy_skill.expected_level

        if candidate_level
          delta  = candidate_level - expected_level
          result = delta.zero? ? 'match' : (delta.positive? ? 'exceed' : 'gap')
          reason = nil
        else
          delta  = nil
          result = 'not_assessed'
          reason = portfolio_skill ? NOT_ASSESSED_REASONS[portfolio_skill[:assessment_status]] : 'not_in_assessment'
        end

        {
          skill_label:         vacancy_skill.skill_label,
          skill_id:            vacancy_skill.skill_id,
          candidate_level:     candidate_level,
          expected_level:      expected_level,
          result:              result,
          delta:               delta,
          confidence:          portfolio_skill&.dig(:confidence),
          is_override:         portfolio_skill&.dig(:overridden) || false,
          not_assessed_reason: reason
        }
      end
    end

    def effective_portfolio_skills
      @portfolio.portfolio_skills.includes(:assessor_override).map do |skill|
        override = skill.assessor_override if skill.assessed?
        {
          skill_id:          skill.skill_id,
          skill_label:       skill.skill_label,
          assessment_status: skill.assessment_status,
          effective_level:   override ? override.override_level : skill.ai_level,
          confidence:        skill.ai_confidence,
          overridden:        override.present?
        }
      end
    end

    def find_portfolio_skill(portfolio_skills, label, skill_id)
      portfolio_skills.find { |s| s[:skill_id] == skill_id && skill_id.present? } ||
        portfolio_skills.find { |s| s[:skill_label].downcase == label.downcase }
    end

    def generate_narratives(skill_comparisons)
      gaps    = skill_comparisons.select { |c| c[:result] == 'gap' }
      matches = skill_comparisons.select { |c| c[:result] == 'match' }
      exceeds = skill_comparisons.select { |c| c[:result] == 'exceed' }
      not_assessed = skill_comparisons.select { |c| c[:result] == 'not_assessed' }

      prompt = build_narrative_prompt(gaps, matches, exceeds, not_assessed)

      begin
        response = @gemini_client.generate_content(prompt, temperature: 0.4)
        data = response.is_a?(Hash) ? response : JSON.parse(response)
        { culture: data['culture_narrative'], overall: data['overall_narrative'] }
      rescue => e
        Rails.logger.error("[N13] Narrative generation failed: #{e.class}")
        { culture: nil, overall: generate_fallback_narrative(skill_comparisons) }
      end
    end

    def build_narrative_prompt(gaps, matches, exceeds, not_assessed)
      vacancy = @vacancy
      portfolio_session = @portfolio.session
      assessment = portfolio_session.assessment

      <<~PROMPT
        You are writing a fit/gap analysis narrative for a candidate evaluation.

        ROLE: #{vacancy.role_title}
        #{vacancy.culture_dimensions.present? ? "CULTURE EXPECTATIONS:\n#{vacancy.culture_dimensions}\n" : ""}
        #{vacancy.competency_expectations.present? ? "COMPETENCY EXPECTATIONS:\n#{vacancy.competency_expectations}\n" : ""}

        SKILL COMPARISON RESULTS:
        - Matches (#{matches.count}): #{matches.map { |c| "#{c[:skill_label]} (L#{c[:candidate_level]})" }.join(', ')}
        - Gaps (#{gaps.count}): #{gaps.map { |c| "#{c[:skill_label]}: candidate L#{c[:candidate_level]} vs expected L#{c[:expected_level]} (delta #{c[:delta]})" }.join(', ')}
        - Exceeds (#{exceeds.count}): #{exceeds.map { |c| "#{c[:skill_label]}: candidate L#{c[:candidate_level]} vs expected L#{c[:expected_level]} (+#{c[:delta]})" }.join(', ')}
        - Not assessed (#{not_assessed.count}): #{not_assessed.map { |c| c[:skill_label] }.join(', ')}

        Not assessed means the interview did not produce enough evidence for that skill.
        It is NOT evidence of weakness. Do not describe it as a gap. Say the level is unknown
        and recommend verifying it before a hiring decision.

        Write two short narrative paragraphs:
        1. culture_narrative: 2-3 sentences on culture/competency fit based on the comparison patterns.
        2. overall_narrative: 2-3 sentence overall hiring recommendation summary.

        OUTPUT (JSON only):
        {
          "culture_narrative": "...",
          "overall_narrative": "..."
        }
      PROMPT
    end

    def generate_fallback_narrative(comparisons)
      gaps    = comparisons.count { |c| c[:result] == 'gap' }
      matches = comparisons.count { |c| c[:result] == 'match' }
      exceeds = comparisons.count { |c| c[:result] == 'exceed' }
      not_assessed = comparisons.count { |c| c[:result] == 'not_assessed' }

      summary = "Candidate shows #{matches} skill matches, #{exceeds} exceeds, and #{gaps} gaps against role requirements."
      return summary if not_assessed.zero?

      "#{summary} #{not_assessed} required skills were not assessed and should be verified before a decision."
    end
  end
end
