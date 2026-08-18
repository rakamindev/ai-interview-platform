module FitGap
  class Comparator
    def initialize(portfolio_skills:, vacancy_skills:)
      @portfolio_skills = portfolio_skills
      @vacancy_skills = vacancy_skills
    end

    def call
      @vacancy_skills.map do |vacancy_skill|
        portfolio_skill = find_portfolio_skill(vacancy_skill)
        candidate_level = normalized_level(portfolio_skill&.fetch(:effective_level, nil))
        required_level = normalized_level(vacancy_skill.fetch(:expected_level, nil))
        assessed = !candidate_level.nil? && !required_level.nil? && portfolio_skill&.fetch(:rating_status, "rated") != "not_assessed"
        delta = assessed ? candidate_level - required_level : nil

        {
          skill_id: vacancy_skill.fetch(:skill_id, nil),
          skill_label: vacancy_skill.fetch(:skill_label, "").to_s.strip,
          candidate_level: assessed ? candidate_level : nil,
          required_level:,
          result: result_for(delta),
          delta:,
          confidence: portfolio_skill&.fetch(:confidence, nil),
          is_override: portfolio_skill&.fetch(:overridden, false) == true,
          rating_status: assessed ? "rated" : "not_assessed"
        }
      end
    end

    private

    def find_portfolio_skill(vacancy_skill)
      skill_id = vacancy_skill.fetch(:skill_id, nil)
      label = normalize_label(vacancy_skill.fetch(:skill_label, nil))

      @portfolio_skills.find { |skill| skill[:skill_id] == skill_id && !skill_id.nil? && skill_id.to_s != "" } ||
        @portfolio_skills.find { |skill| normalize_label(skill[:skill_label]) == label }
    end

    def normalized_level(value)
      return value if value.is_a?(Integer) && value.between?(1, 5)
      return value.to_i if value.is_a?(String) && value.match?(/\A[1-5]\z/)

      nil
    end

    def result_for(delta)
      return "not_assessed" if delta.nil?
      return "match" if delta.zero?

      delta.positive? ? "exceed" : "gap"
    end

    def normalize_label(value)
      value.to_s.strip.downcase.gsub(/\s+/, " ")
    end
  end
end
