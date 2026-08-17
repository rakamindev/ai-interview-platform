# frozen_string_literal: true

module FitGap
  # N13: Generates a fit/gap report comparing a portfolio against a vacancy.
  # Uses rule-based comparison for skill levels + Gemini Flash for culture narrative.
  class Engine
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
      @session_coverage_maps = @portfolio.session.coverage_maps.index_by(&:skill_label)
      skill_comparisons = build_skill_comparisons
      narratives        = generate_narratives(skill_comparisons)

      report = @portfolio.fit_gap_reports.find_or_initialize_by(vacancy_id: @vacancy.id)

      report.update!(
        skill_comparisons: skill_comparisons,
        culture_narrative: narratives[:culture],
        overall_narrative: narratives[:overall],
        generated_at:      Time.current
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
        coverage_map    = @session_coverage_maps[label]

        if portfolio_skill
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

        {
          skill_label:        label,
          skill_id:           vacancy_skill.skill_id,
          required_level:     expected_level,
          expected_level:     expected_level,
          candidate_level:    candidate_level,
          ai_level:           portfolio_skill&.dig(:ai_level),
          override_level:     portfolio_skill&.dig(:override_level),
          assessor_notes:     portfolio_skill&.dig(:assessor_notes),
          result:             result,
          delta:              delta,
          confidence:         portfolio_skill&.dig(:confidence),
          is_override:        portfolio_skill&.dig(:overridden) || false,
          evidence:           portfolio_skill&.dig(:evidence) || [],
          competency_summary: portfolio_skill&.dig(:competency_summary),
          probe_count:        coverage_map&.probe_count,
          coverage_state:     coverage_map&.state
        }
      end

      comparisons
    end

    # Returns portfolio skills with overrides applied.
    def effective_portfolio_skills
      @portfolio.portfolio_skills.includes(:assessor_override).map do |skill|
        override = skill.assessor_override
        {
          id:                 skill.id,
          skill_id:           skill.skill_id,
          skill_label:        skill.skill_label,
          ai_level:           skill.ai_level,
          override_level:     override&.override_level,
          effective_level:    override ? override.override_level : skill.ai_level,
          confidence:         skill.ai_confidence,
          overridden:         override.present?,
          assessor_notes:     override&.assessor_notes,
          overridden_by:      override&.overridden_by,
          overridden_at:      override&.overridden_at,
          evidence:           skill.evidence_quotes,
          competency_summary: skill.competency_summary
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
        Rails.logger.error("[N13] Narrative generation failed: #{e.message}")
        { culture: nil, overall: generate_fallback_narrative(skill_comparisons) }
      end
    end

    def format_comparison_item(c)
      if c[:is_override]
        notes = c[:assessor_notes].present? ? " (Assessor note: \"#{c[:assessor_notes]}\")" : ""
        "#{c[:skill_label]}: Final L#{c[:candidate_level]} [Human Calibrated from AI L#{c[:ai_level]}] vs expected L#{c[:expected_level]}#{notes}"
      else
        "#{c[:skill_label]}: L#{c[:candidate_level]} (AI rated, confidence: #{c[:confidence]}) vs expected L#{c[:expected_level]}"
      end
    end

    def build_narrative_prompt(gaps, matches, exceeds, not_assessed)
      vacancy = @vacancy
      portfolio_session = @portfolio.session
      assessment = portfolio_session.assessment

      matches_text = matches.map { |c| format_comparison_item(c) }.join("\n  - ")
      gaps_text    = gaps.map { |c| "#{format_comparison_item(c)} (gap #{c[:delta]})" }.join("\n  - ")
      exceeds_text = exceeds.map { |c| "#{format_comparison_item(c)} (+#{c[:delta]})" }.join("\n  - ")
      not_assessed_text = not_assessed.map { |c| "#{c[:skill_label]} (required L#{c[:expected_level]})" }.join(', ')

      <<~PROMPT
        You are writing a fit/gap analysis narrative for a candidate evaluation.

        ROLE: #{vacancy.role_title}
        #{vacancy.culture_dimensions.present? ? "CULTURE EXPECTATIONS:\n#{vacancy.culture_dimensions}\n" : ""}
        #{vacancy.competency_expectations.present? ? "COMPETENCY EXPECTATIONS:\n#{vacancy.competency_expectations}\n" : ""}

        SKILL COMPARISON RESULTS:
        - Matches (#{matches.count}):
          - #{matches_text.presence || 'None'}
        - Gaps (#{gaps.count}):
          - #{gaps_text.presence || 'None'}
        - Exceeds (#{exceeds.count}):
          - #{exceeds_text.presence || 'None'}
        - Not assessed (#{not_assessed.count}): #{not_assessed_text.presence || 'None'}

        CONTEXT ON HUMAN CALIBRATIONS:
        Some skill ratings were reviewed and calibrated by a human assessor. If a skill shows [Human Calibrated from AI], synthesize both the AI behavioral observations and the human assessor's calibration notes to produce a balanced, authoritative assessment.

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

      "Candidate shows #{matches} skill matches, #{exceeds} exceeds, and #{gaps} gaps against role requirements."
    end
  end
end
