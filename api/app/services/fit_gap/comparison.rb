# frozen_string_literal: true

module FitGap
  class Comparison
    def initialize(requirements:, skills:)
      @requirements = requirements
      @skills = skills
    end

    def call
      @requirements.map do |requirement|
        candidates = matching_skills(requirement)
        skill = candidates.one? ? candidates.first : nil
        expected = level(requirement[:expected_level])
        overridden = skill && skill[:override_level_present]
        candidate = skill && level(overridden ? skill[:override_level] : skill[:ai_level])
        reason = if expected.nil?
                   'invalid_requirement'
                 elsif candidates.size > 1
                   'ambiguous_skill'
                 elsif skill.nil?
                   'missing_skill'
                 elsif candidate.nil?
                   'missing_rating'
                 end
        candidate = nil if reason
        delta = candidate && expected ? candidate - expected : nil

        {
          vacancy_skill_id: requirement[:id],
          skill_id: requirement[:skill_id],
          skill_label: requirement[:skill_label],
          expected_level: expected,
          candidate_level: candidate,
          result: delta.nil? ? 'not_assessed' : (delta.zero? ? 'match' : (delta.positive? ? 'exceed' : 'gap')),
          delta: delta,
          reason: reason,
          portfolio_skill_id: skill && skill[:id],
          is_override: !!overridden,
          rating_source: candidate ? (overridden ? 'assessor' : 'ai') : nil,
          confidence: skill && %w[high medium low].include?(skill[:confidence]) ? skill[:confidence] : nil
        }
      end
    end

    private

    def level(value)
      return value if value.is_a?(Integer) && (1..5).cover?(value)
      return value.to_i if value.is_a?(String) && /\A[1-5]\z/.match?(value)

      nil
    end

    def identifier(value)
      value.to_s.strip
    end

    def label(value)
      value.to_s.strip.downcase.gsub(/\s+/, ' ')
    end

    def matching_skills(requirement)
      id = identifier(requirement[:skill_id])
      exact = @skills.select { |skill| !id.empty? && identifier(skill[:skill_id]) == id }
      return exact unless exact.empty?

      name = label(requirement[:skill_label])
      return [] if name.empty?

      @skills.select do |skill|
        (id.empty? || identifier(skill[:skill_id]).empty?) && label(skill[:skill_label]) == name
      end
    end
  end
end
