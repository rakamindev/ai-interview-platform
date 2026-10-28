# frozen_string_literal: true

module FitGap
  # N13: Generates a fit/gap report comparing a portfolio against a vacancy.
  # Uses rule-based comparison for skill levels + Gemini Flash for culture narrative.
  class Engine
    # Bump when the comparison rules change, so reports built with older rules show as stale.
    # 2: unmeasured skills are not gaps; low-confidence results are provisional.
    RULES_VERSION = 2

    def initialize(portfolio:, vacancy:, gemini_client: nil)
      @portfolio = portfolio
      @vacancy   = vacancy
      @gemini_client = gemini_client || Gemini::HttpClient.new(
        model:   ENV.fetch('GEMINI_FLASH_MODEL', 'gemini-2.0-flash-001'),
        timeout: 30
      )
    end

    # Returns the FitGapReport record.
    def call
      skill_comparisons = build_skill_comparisons
      narratives        = generate_narratives(skill_comparisons)

      report = FitGapReport.find_or_initialize_by(
        portfolio_id: @portfolio.id,
        vacancy_id:   @vacancy.id
      )

      report.update!(
        skill_comparisons: skill_comparisons,
        culture_narrative: narratives[:culture],
        overall_narrative: narratives[:overall],
        generated_at:      Time.current,
        rules_version:     RULES_VERSION
      )

      Rails.logger.info("[N13] Fit/gap report generated: portfolio=#{@portfolio.id} vacancy=#{@vacancy.id}")
      report
    end

    private

    def build_skill_comparisons
      vacancy_skills = @vacancy.vacancy_skills.index_by(&:skill_label)
      portfolio_skills = effective_portfolio_skills  # includes overrides

      comparisons = vacancy_skills.map do |label, vacancy_skill|
        portfolio_skill = find_portfolio_skill(portfolio_skills, label, vacancy_skill.skill_id)

        if portfolio_skill && portfolio_skill[:effective_level].nil?
          # Not measured (or model output not trusted) and no assessor override: never a gap.
          candidate_level = nil
          expected_level  = vacancy_skill.expected_level
          delta           = nil
          result          = portfolio_skill[:assessment_status]
        elsif portfolio_skill
          candidate_level  = portfolio_skill[:effective_level]
          expected_level   = vacancy_skill.expected_level
          delta            = candidate_level - expected_level
          result           = delta == 0 ? 'match' : (delta > 0 ? 'exceed' : 'gap')
        else
          candidate_level = nil
          expected_level  = vacancy_skill.expected_level
          delta           = nil
          result          = 'not_assessed'
        end

        overridden = portfolio_skill&.dig(:overridden) || false
        confidence = portfolio_skill&.dig(:confidence)

        {
          skill_label:       label,
          skill_id:          vacancy_skill.skill_id,
          candidate_level:   candidate_level,
          expected_level:    expected_level,
          ai_level:          portfolio_skill&.dig(:ai_level),
          result:            result,
          delta:             delta,
          confidence:        confidence,
          # One question is not enough to call a match or a gap; an assessor's override is.
          provisional:       !overridden && confidence == 'low' && %w[match gap exceed].include?(result),
          overridden:        overridden,
          assessment_status: portfolio_skill&.dig(:assessment_status)
        }
      end

      comparisons
    end

    # Returns portfolio skills with overrides applied.
    def effective_portfolio_skills
      @portfolio.portfolio_skills.includes(:assessor_override).map do |skill|
        override = skill.assessor_override
        {
          id:              skill.id,
          skill_id:        skill.skill_id,
          skill_label:     skill.skill_label,
          ai_level:        skill.ai_level,
          assessment_status: skill.assessment_status,
          effective_level: override ? override.override_level : skill.ai_level,
          confidence:      skill.ai_confidence,
          overridden:      override.present?
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
      needs_review = skill_comparisons.select { |c| c[:result] == 'needs_review' }

      prompt = build_narrative_prompt(gaps, matches, exceeds, not_assessed, needs_review, competency_summaries)

      begin
        response = @gemini_client.generate_content(prompt, temperature: 0.4)
        data = response.is_a?(Hash) ? response : JSON.parse(response)
        { culture: data['culture_narrative'], overall: data['overall_narrative'] }
      rescue => e
        Rails.logger.error("[N13] Narrative generation failed: #{e.message}")
        { culture: nil, overall: generate_fallback_narrative(skill_comparisons) }
      end
    end

    def build_narrative_prompt(gaps, matches, exceeds, not_assessed, needs_review, summaries)
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
        - Needs review (#{needs_review.count}): #{needs_review.map { |c| c[:skill_label] }.join(', ')}

        COMPETENCY SUMMARIES (assessed skills only):
        #{summaries.join("\n")}

        Results marked low confidence rest on a single question; call them provisional.
        Skills under Not assessed or Needs review were not measured in this interview: do not describe them as strengths or weaknesses, only as open questions for a follow-up conversation.

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

    def competency_summaries
      @portfolio.portfolio_skills.select { |s| s.assessed? && s.competency_summary.present? }.map do |s|
        "- #{s.skill_label} (L#{s.ai_level}, #{s.ai_confidence} confidence): #{s.competency_summary}"
      end
    end

    def generate_fallback_narrative(comparisons)
      gaps    = comparisons.count { |c| c[:result] == 'gap' }
      matches = comparisons.count { |c| c[:result] == 'match' }
      exceeds = comparisons.count { |c| c[:result] == 'exceed' }
      not_assessed = comparisons.count { |c| c[:result] == 'not_assessed' }
      needs_review = comparisons.count { |c| c[:result] == 'needs_review' }

      text = "Candidate shows #{matches} skill matches, #{exceeds} exceeds, and #{gaps} gaps against role requirements."
      return text if (not_assessed + needs_review).zero?

      "#{text} #{not_assessed} not assessed and #{needs_review} needing review were left out of the comparison."
    end
  end
end
