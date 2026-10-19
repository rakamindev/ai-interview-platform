# frozen_string_literal: true

module FitGap
  # Compares vacancy expectations with the effective portfolio level.
  #
  # Matching prefers skill_id. The label fallback is case-insensitive and
  # ignores surrounding whitespace, because assessors and the model do not
  # emit identical strings.
  class ComparisonBuilder
    def self.build(vacancy_skills:, portfolio_skills:)
      new(vacancy_skills: vacancy_skills, portfolio_skills: portfolio_skills).build
    end

    def initialize(vacancy_skills:, portfolio_skills:)
      @vacancy_skills = Array(vacancy_skills).map { |row| stringify(row) }
      @portfolio_skills = Array(portfolio_skills).map { |row| stringify(row) }
    end

    def build
      @vacancy_skills.map do |vacancy_skill|
        portfolio_skill = find_portfolio_skill(vacancy_skill)
        required = integer_or_nil(vacancy_skill['expected_level'])
        candidate = portfolio_skill && integer_or_nil(portfolio_skill['effective_level'])
        confidence = portfolio_skill && portfolio_skill['confidence']
        overridden = portfolio_skill ? truthy?(portfolio_skill['overridden']) : false

        if portfolio_skill.nil? || candidate.nil? || required.nil?
          evidence_status = portfolio_skill.nil? ? 'not_assessed' : 'insufficient_evidence'
          {
            'skill_label' => vacancy_skill['skill_label'].to_s,
            'skill_id' => vacancy_skill['skill_id'],
            'required_level' => required,
            'expected_level' => required,
            'candidate_level' => candidate,
            'result' => 'not_assessed',
            'delta' => nil,
            'confidence' => confidence,
            'is_override' => overridden,
            'evidence_status' => evidence_status
          }
        else
          delta = candidate - required
          result = if delta.zero?
                     'match'
                   elsif delta.positive?
                     'exceed'
                   else
                     'gap'
                   end
          {
            'skill_label' => vacancy_skill['skill_label'].to_s,
            'skill_id' => vacancy_skill['skill_id'],
            'required_level' => required,
            'expected_level' => required,
            'candidate_level' => candidate,
            'result' => result,
            'delta' => delta,
            'confidence' => confidence,
            'is_override' => overridden,
            'evidence_status' => 'assessed'
          }
        end
      end
    end

    private

    def find_portfolio_skill(vacancy_skill)
      skill_id = vacancy_skill['skill_id']
      if skill_id.to_s.strip != ''
        found = @portfolio_skills.find { |skill| skill['skill_id'].to_s == skill_id.to_s }
        return found if found
      end

      label = vacancy_skill['skill_label'].to_s.strip.downcase
      return nil if label.empty?

      @portfolio_skills.find { |skill| skill['skill_label'].to_s.strip.downcase == label }
    end

    def stringify(row)
      return {} unless row.is_a?(Hash)

      row.each_with_object({}) { |(key, value), memo| memo[key.to_s] = value }
    end

    def integer_or_nil(value)
      return value if value.is_a?(Integer) && (1..5).cover?(value)
      return nil unless value.is_a?(String) && value.strip.match?(/\A[1-5]\z/)

      value.to_i
    end

    def truthy?(value)
      value == true || value.to_s == 'true'
    end
  end
end
