# frozen_string_literal: true

module FitGap
  # Builds the deterministic portion of a Fit/Gap report.
  #
  # This class must not call Gemini. A comparison remains useful and
  # explainable even when narrative generation is unavailable.
  class ComparisonBuilder
    def initialize(portfolio:, vacancy:)
      @portfolio = portfolio
      @vacancy = vacancy
    end

    # Returns the canonical comparison payload consumed by the API and UI.
    def call
      portfolio_skills = loaded_portfolio_skills
      matched_keys = []
      ambiguous_labels = []

      comparisons = @vacancy.vacancy_skills.map do |vacancy_skill|
        match = find_match(vacancy_skill, portfolio_skills)
        matched_keys << portfolio_key(match[:skill]) if match[:skill]
        ambiguous_labels << vacancy_skill.skill_label if match[:issue] == :ambiguous

        build_comparison(vacancy_skill, match)
      end

      {
        skill_comparisons: comparisons,
        summary: build_summary(comparisons),
        caveats: build_caveats(
          comparisons: comparisons,
          portfolio_skills: portfolio_skills,
          ambiguous_labels: ambiguous_labels
        ),
        additional_skill_signals: build_additional_signals(
          portfolio_skills,
          matched_keys
        )
      }
    end

    private

    def loaded_portfolio_skills
      @portfolio.portfolio_skills.includes(:assessor_override).to_a
    end

    def find_match(vacancy_skill, portfolio_skills)
      vacancy_id = vacancy_skill.skill_id

      if vacancy_id.present?
        id_matches = portfolio_skills.select do |portfolio_skill|
          portfolio_skill.skill_id.present? && portfolio_skill.skill_id == vacancy_id
        end

        return { skill: id_matches.first } if id_matches.one?
        return { skill: nil, issue: :ambiguous } if id_matches.many?

        # Label fallback is allowed for legacy/custom Portfolio skills without IDs,
        # but never across two different stable IDs.
      end

      label_matches = portfolio_skills.select do |portfolio_skill|
        next false if vacancy_id.present? && portfolio_skill.skill_id.present?

        normalize_label(portfolio_skill.skill_label) == normalize_label(vacancy_skill.skill_label)
      end

      return { skill: label_matches.first } if label_matches.one?
      return { skill: nil, issue: :ambiguous } if label_matches.many?

      { skill: nil }
    end

    def build_comparison(vacancy_skill, match)
      portfolio_skill = match[:skill]
      expected_level = vacancy_skill.expected_level

      unless portfolio_skill
        return comparison_hash(
          vacancy_skill: vacancy_skill,
          candidate_level: nil,
          expected_level: expected_level,
          result: "not_assessed",
          delta: nil,
          confidence: nil,
          is_override: false,
          caveat: match[:issue] == :ambiguous ? "Ambiguous skill match" : "No usable evidence"
        )
      end

      effective_level = effective_level_for(portfolio_skill)
      confidence = portfolio_skill.ai_confidence.presence
      evidence_available = usable_evidence?(portfolio_skill)

      unless evidence_available && valid_level?(effective_level)
        return comparison_hash(
          vacancy_skill: vacancy_skill,
          candidate_level: nil,
          expected_level: expected_level,
          result: "not_assessed",
          delta: nil,
          confidence: nil,
          is_override: portfolio_skill.assessor_override.present?,
          caveat: "No usable evidence"
        )
      end

      candidate_level = Integer(effective_level)
      delta = candidate_level - expected_level

      comparison_hash(
        vacancy_skill: vacancy_skill,
        candidate_level: candidate_level,
        expected_level: expected_level,
        result: result_for(delta),
        delta: delta,
        confidence: confidence,
        is_override: portfolio_skill.assessor_override.present?,
        caveat: nil
      )
    end

    def comparison_hash(vacancy_skill:, candidate_level:, expected_level:, result:, delta:, confidence:, is_override:, caveat:)
      {
        skill_label: vacancy_skill.skill_label,
        skill_id: vacancy_skill.skill_id,
        expected_level: expected_level,
        candidate_level: candidate_level,
        result: result,
        delta: delta,
        confidence: confidence,
        is_override: is_override,
        caveat: caveat
      }
    end

    def build_summary(comparisons)
      gaps = comparisons.select { |comparison| comparison[:result] == "gap" }

      {
        match_count: comparisons.count { |comparison| comparison[:result] == "match" },
        exceed_count: comparisons.count { |comparison| comparison[:result] == "exceed" },
        gap_count: gaps.length,
        not_assessed_count: comparisons.count { |comparison| comparison[:result] == "not_assessed" },
        priority_gaps: gaps.sort_by { |comparison| comparison[:delta] }.map { |comparison| comparison[:skill_label] }
      }
    end

    def build_caveats(comparisons:, portfolio_skills:, ambiguous_labels:)
      caveats = []
      not_assessed_count = comparisons.count { |comparison| comparison[:result] == "not_assessed" }
      low_confidence_count = portfolio_skills.count do |skill|
        usable_evidence?(skill) && skill.ai_confidence.to_s.downcase == "low"
      end

      if not_assessed_count.positive?
        noun = not_assessed_count == 1 ? "skill has" : "skills have"
        caveats << "#{not_assessed_count} required #{noun} no usable evidence."
      end

      if low_confidence_count.positive?
        noun = low_confidence_count == 1 ? "skill has" : "skills have"
        caveats << "#{low_confidence_count} assessed #{noun} low confidence."
      end

      ambiguous_labels.uniq.each do |label|
        caveats << "#{label} has ambiguous Portfolio skill matches."
      end

      caveats << "Vacancy has no required skills." if comparisons.empty?
      caveats
    end

    def build_additional_signals(portfolio_skills, matched_keys)
      portfolio_skills.reject { |skill| matched_keys.include?(portfolio_key(skill)) }.map do |skill|
        level = effective_level_for(skill)
        assessed = usable_evidence?(skill) && valid_level?(level)

        {
          skill_id: skill.skill_id,
          skill_label: skill.skill_label,
          candidate_level: assessed ? Integer(level) : nil,
          confidence: assessed ? skill.ai_confidence.presence : nil,
          is_override: skill.assessor_override.present?,
          caveat: assessed ? nil : "No usable evidence"
        }
      end
    end

    def effective_level_for(portfolio_skill)
      override = portfolio_skill.assessor_override
      override ? override.override_level : portfolio_skill.ai_level
    end

    def usable_evidence?(portfolio_skill)
      Array(portfolio_skill.evidence_quotes).any? do |quote|
        quote.respond_to?(:to_s) && !quote.to_s.strip.empty?
      end
    end

    def valid_level?(level)
      Integer(level).between?(1, 5)
    rescue ArgumentError, TypeError
      false
    end

    def result_for(delta)
      return "match" if delta.zero?

      delta.positive? ? "exceed" : "gap"
    end

    def portfolio_key(portfolio_skill)
      portfolio_skill.id || portfolio_skill.object_id
    end

    def normalize_label(label)
      label.to_s.strip.downcase.gsub(/\s+/, " ")
    end
  end
end
