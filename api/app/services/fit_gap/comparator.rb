# frozen_string_literal: true

module FitGap
  # Compares a portfolio against a vacancy's skill requirements, one row per
  # required skill. Pure and deterministic: no AI decides a verdict.
  #
  # A verdict about a person needs evidence behind it:
  #   - A skill the interview never reached is `not_assessed`, never a gap.
  #   - A rating the AI made from a brief exchange (confidence "low") is
  #     `insufficient_evidence`. The direction it points is kept as
  #     `provisional_result` so an assessor knows what to confirm, but it is
  #     not presented as a verdict until an assessor confirms a level.
  #   - An assessor override is a human-confirmed level and always decides.
  class Comparator
    # Bump when the rules change, so reports stored under older rules are
    # recomputed instead of being shown to a hiring team.
    VERSION = 2

    RESULTS = %w[gap insufficient_evidence not_assessed match exceed].freeze

    # The generator assigns "low" for a skill probed at most once or only
    # initiated (see Portfolios::Generator#build_prompt).
    UNCONFIRMED_CONFIDENCE = 'low'

    def initialize(portfolio:, vacancy:)
      @portfolio = portfolio
      @vacancy   = vacancy
    end

    # Returns an array of comparison hashes, ordered so the rows that need a
    # decision come first (see RESULTS).
    def call
      requirements.map { |requirement| compare(requirement) }
                  .sort_by.with_index { |row, i| [RESULTS.index(row[:result]), i] }
    end

    private

    def compare(requirement)
      skill    = rated_skill_for(requirement)
      expected = requirement.expected_level

      return row(requirement, skill, result: 'not_assessed') unless skill

      override  = skill.assessor_override
      level     = override ? override.override_level : skill.ai_level
      direction = verdict(level, expected)

      if override.nil? && unconfirmed?(skill)
        row(requirement, skill, result: 'insufficient_evidence', provisional_result: direction)
      else
        row(requirement, skill, result: direction, candidate_level: level, delta: level - expected)
      end
    end

    def row(requirement, skill, result:, candidate_level: nil, delta: nil, provisional_result: nil)
      {
        skill_label:        requirement.skill_label,
        skill_id:           requirement.skill_id,
        expected_level:     requirement.expected_level,
        candidate_level:    candidate_level,
        ai_level:           skill&.ai_level,
        confidence:         skill&.ai_confidence,
        overridden:         skill&.assessor_override.present? || false,
        portfolio_skill_id: skill&.id,
        result:             result,
        provisional_result: provisional_result,
        delta:              delta
      }
    end

    def verdict(level, expected)
      if level > expected then 'exceed'
      elsif level < expected then 'gap'
      else 'match'
      end
    end

    def unconfirmed?(skill)
      skill.ai_confidence.to_s.casecmp?(UNCONFIRMED_CONFIDENCE)
    end

    # One requirement per skill. A duplicated requirement keeps the stricter
    # expectation rather than whichever row happened to be saved last.
    def requirements
      @vacancy.vacancy_skills.order(:id)
              .group_by { |s| normalize(s.skill_label) }
              .map { |_, dupes| dupes.max_by(&:expected_level) }
    end

    # Configured skills first, so a discovered skill with the same name never
    # shadows the one the interview was designed to assess.
    def rated_skills
      @rated_skills ||= @portfolio.portfolio_skills.includes(:assessor_override)
                                  .sort_by { |s| s.is_discovered ? 1 : 0 }
    end

    def rated_skill_for(requirement)
      by_id = requirement.skill_id.presence &&
              rated_skills.find { |s| s.skill_id.to_s.casecmp?(requirement.skill_id) }

      by_id || rated_skills.find { |s| normalize(s.skill_label) == normalize(requirement.skill_label) }
    end

    def normalize(label)
      label.to_s.squish.downcase
    end
  end
end
