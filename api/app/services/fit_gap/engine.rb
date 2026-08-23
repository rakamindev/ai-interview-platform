# frozen_string_literal: true

module FitGap
  # N13: Generates a fit/gap report comparing a portfolio against a vacancy.
  # Uses rule-based comparison for skill levels + Gemini Flash for culture narrative.
  class Engine
    SCHEMA_VERSION = 1

    # Confidence levels that produce a hard verdict.
    CONFIDENCE_THRESHOLD = %w[high medium].freeze

    def initialize(portfolio:, vacancy:, gemini_client: nil)
      @portfolio = portfolio
      @vacancy   = vacancy
      @gemini_client = gemini_client || Gemini::ClientFactory.build(
        model: ENV.fetch("GEMINI_FLASH_MODEL", "gemini-3.5-flash"),
        timeout: 30
      )
    end

    # Returns the FitGapReport record.
    def call
      skill_comparisons  = build_skill_comparisons
      additional         = build_additional_strengths
      narratives         = generate_narratives(skill_comparisons)

      report = FitGapReport.find_or_initialize_by(
        portfolio_id: @portfolio.id,
        vacancy_id: @vacancy.id
      )

      report.update!(
        skill_comparisons: skill_comparisons,
        additional_strengths: additional,
        culture_narrative: narratives[:culture],
        overall_narrative: narratives[:overall],
        generated_at: Time.current,
        tenant_id: @portfolio.tenant_id
      )

      Rails.logger.info("[N13] Fit/gap report generated: portfolio=#{@portfolio.id} vacancy=#{@vacancy.id}")
      report
    end

    private

    # AC-1.1–1.9, 1.11–1.15: emit full comparison payload per vacancy skill.
    # AC-1.5: low confidence → insufficient_evidence verdict.
    # AC-1.7: unrated skill → not_assessed, never gap.
    def build_skill_comparisons
      vacancy_skills   = @vacancy.vacancy_skills.index_by(&:skill_label)
      portfolio_skills = effective_portfolio_skills

      vacancy_skills.map do |label, vacancy_skill|
        portfolio_skill = find_portfolio_skill(portfolio_skills, label, vacancy_skill.skill_id)

        if portfolio_skill.nil?
          # AC-1.4: absent from portfolio → not_assessed, never gap.
          build_missing_comparison(label, vacancy_skill)
        elsif portfolio_skill[:ai_level].nil?
          # AC-1.7: assessed but unrated → not_assessed, not gap.
          build_unrated_comparison(label, vacancy_skill, portfolio_skill)
        else
          build_level_comparison(label, vacancy_skill, portfolio_skill)
        end
      end
    end

    def build_missing_comparison(label, vacancy_skill)
      {
        skill_label: label,
        skill_id: vacancy_skill.skill_id,
        candidate_level: nil,
        expected_level: vacancy_skill.expected_level,
        ai_level: nil,
        effective_level: nil,
        level_source: "none",
        confidence: nil,
        is_override: false,
        delta: nil,
        result: "not_assessed",
        schema_version: SCHEMA_VERSION
      }
    end

    def build_unrated_comparison(label, vacancy_skill, portfolio_skill)
      {
        skill_label: label,
        skill_id: vacancy_skill.skill_id,
        candidate_level: nil,
        expected_level: vacancy_skill.expected_level,
        ai_level: nil,
        effective_level: nil,
        level_source: portfolio_skill[:level_source],
        confidence: portfolio_skill[:confidence],
        is_override: portfolio_skill[:is_override],
        delta: nil,
        result: "not_assessed",
        schema_version: SCHEMA_VERSION
      }
    end

    def build_level_comparison(label, vacancy_skill, portfolio_skill)
      candidate_level = portfolio_skill[:effective_level]
      expected_level  = vacancy_skill.expected_level
      delta           = candidate_level - expected_level

      # AC-1.5: low confidence → insufficient_evidence (delta shown, not asserted).
      confidence = portfolio_skill[:confidence]
      result = if confidence.present? && CONFIDENCE_THRESHOLD.exclude?(confidence)
                 "insufficient_evidence"
               elsif delta.zero?
                 "match"
               else
                 (delta.positive? ? "exceed" : "gap")
               end

      {
        skill_label: label,
        skill_id: vacancy_skill.skill_id,
        candidate_level: candidate_level,
        expected_level: expected_level,
        ai_level: portfolio_skill[:ai_level],
        effective_level: candidate_level,
        level_source: portfolio_skill[:level_source],
        confidence: confidence,
        is_override: portfolio_skill[:is_override],
        delta: delta,
        result: result,
        schema_version: SCHEMA_VERSION
      }
    end

    # AC-1.10: portfolio skills not in vacancy → additional_strengths.
    def build_additional_strengths
      vacancy_skill_ids = @vacancy.vacancy_skills.pluck(:skill_id).compact
      vacancy_labels    = @vacancy.vacancy_skills.pluck(:skill_label).map(&:downcase)

      effective_portfolio_skills.reject do |ps|
        in_vacancy = (ps[:skill_id].present? && vacancy_skill_ids.include?(ps[:skill_id])) ||
                     vacancy_labels.include?(ps[:skill_label]&.downcase)
        in_vacancy
      end.map do |ps|
        {
          skill_label: ps[:skill_label],
          skill_id: ps[:skill_id],
          ai_level: ps[:ai_level],
          effective_level: ps[:effective_level],
          level_source: ps[:level_source],
          confidence: ps[:confidence],
          is_override: ps[:is_override],
          schema_version: SCHEMA_VERSION
        }
      end
    end

    # Returns portfolio skills with overrides applied.
    # AC-1.8: override present → effective_level = override; level_source: "assessor"; is_override: true.
    # AC-1.9: no override → level_source: "ai"; is_override: false.
    def effective_portfolio_skills
      @portfolio.portfolio_skills.includes(:assessor_override).map do |skill|
        override = skill.assessor_override
        {
          id: skill.id,
          skill_id: skill.skill_id,
          skill_label: skill.skill_label,
          ai_level: skill.ai_level,
          effective_level: override ? override.override_level : skill.ai_level,
          confidence: skill.ai_confidence,
          level_source: override ? "assessor" : "ai",
          is_override: override.present?
        }
      end
    end

    def find_portfolio_skill(portfolio_skills, label, skill_id)
      # AC-1.14: match by skill_id first, then case-insensitive label.
      portfolio_skills.find { |s| s[:skill_id] == skill_id && skill_id.present? } ||
        portfolio_skills.find { |s| s[:skill_label].downcase == label.downcase }
    end

    def generate_narratives(skill_comparisons)
      gaps               = skill_comparisons.select { |c| c[:result] == "gap" }
      matches            = skill_comparisons.select { |c| c[:result] == "match" }
      exceeds            = skill_comparisons.select { |c| c[:result] == "exceed" }
      not_assessed       = skill_comparisons.select { |c| c[:result] == "not_assessed" }
      insufficient_evidence = skill_comparisons.select { |c| c[:result] == "insufficient_evidence" }

      prompt = build_narrative_prompt(gaps, matches, exceeds, not_assessed, insufficient_evidence)

      begin
        response = @gemini_client.generate_content(prompt, temperature: 0.4)
        data = response.is_a?(Hash) ? response : JSON.parse(response)
        { culture: data["culture_narrative"], overall: data["overall_narrative"] }
      rescue StandardError => e
        Rails.logger.error("[N13] Narrative generation failed: #{e.message}")
        { culture: nil, overall: generate_fallback_narrative(skill_comparisons) }
      end
    end

    def build_narrative_prompt(gaps, matches, exceeds, not_assessed, insufficient_evidence)
      vacancy = @vacancy
      portfolio_session = @portfolio.session
      portfolio_session.assessment

      <<~PROMPT
        You are writing a fit/gap analysis narrative for a candidate evaluation.

        ROLE: #{vacancy.role_title}
        #{"CULTURE EXPECTATIONS:\n#{vacancy.culture_dimensions}\n" if vacancy.culture_dimensions.present?}
        #{"COMPETENCY EXPECTATIONS:\n#{vacancy.competency_expectations}\n" if vacancy.competency_expectations.present?}

        SKILL COMPARISON RESULTS:
        - Matches (#{matches.count}): #{matches.map { |c| "#{c[:skill_label]} (L#{c[:candidate_level]})" }.join(', ')}
        - Gaps (#{gaps.count}): #{gaps.map { |c| "#{c[:skill_label]}: candidate L#{c[:candidate_level]} vs expected L#{c[:expected_level]} (delta #{c[:delta]})" }.join(', ')}
        - Exceeds (#{exceeds.count}): #{exceeds.map { |c| "#{c[:skill_label]}: candidate L#{c[:candidate_level]} vs expected L#{c[:expected_level]} (+#{c[:delta]})" }.join(', ')}
        - Not assessed (#{not_assessed.count}): #{not_assessed.pluck(:skill_label).join(', ')}
        - Insufficient evidence (#{insufficient_evidence.count}): #{insufficient_evidence.map { |c| "#{c[:skill_label]} (confidence: #{c[:confidence]})" }.join(', ')}

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
      gaps    = comparisons.count { |c| c[:result] == "gap" }
      matches = comparisons.count { |c| c[:result] == "match" }
      exceeds = comparisons.count { |c| c[:result] == "exceed" }

      "Candidate shows #{matches} skill matches, #{exceeds} exceeds, and #{gaps} gaps against role requirements."
    end
  end
end
