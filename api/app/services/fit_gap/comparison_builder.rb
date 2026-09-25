# frozen_string_literal: true

module FitGap
  # Builds deterministic skill-by-skill comparisons between a completed
  # candidate portfolio and a vacancy. This layer intentionally contains no
  # LLM calls so the decision-support math stays testable and reproducible.
  class ComparisonBuilder
    def initialize(portfolio:, vacancy:)
      @portfolio = portfolio
      @vacancy = vacancy
    end

    def call
      portfolio_skills = effective_portfolio_skills

      @vacancy.vacancy_skills.map do |vacancy_skill|
        portfolio_skill = find_portfolio_skill(
          portfolio_skills,
          vacancy_skill.skill_label,
          vacancy_skill.skill_id
        )

        build_comparison(vacancy_skill, portfolio_skill)
      end
    end

    private

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
          overridden: override.present?,
          competency_summary: skill.competency_summary,
          evidence_count: skill.evidence_quotes.size
        }
      end
    end

    def build_comparison(vacancy_skill, portfolio_skill)
      expected_level = vacancy_skill.expected_level

      unless portfolio_skill
        return {
          skill_label: vacancy_skill.skill_label,
          skill_id: vacancy_skill.skill_id,
          candidate_level: nil,
          expected_level: expected_level,
          result: 'not_assessed',
          delta: nil,
          confidence: nil,
          overridden: false,
          evidence_count: 0,
          competency_summary: nil
        }
      end

      candidate_level = portfolio_skill[:effective_level]
      delta = candidate_level - expected_level

      {
        skill_label: vacancy_skill.skill_label,
        skill_id: vacancy_skill.skill_id,
        candidate_level: candidate_level,
        expected_level: expected_level,
        result: comparison_result(delta),
        delta: delta,
        confidence: portfolio_skill[:confidence],
        overridden: portfolio_skill[:overridden],
        evidence_count: portfolio_skill[:evidence_count],
        competency_summary: portfolio_skill[:competency_summary]
      }
    end

    def comparison_result(delta)
      return 'match' if delta.zero?
      return 'exceed' if delta.positive?

      'gap'
    end

    def find_portfolio_skill(portfolio_skills, label, skill_id)
      if skill_id.present?
        exact_id_match = portfolio_skills.find do |skill|
          skill[:skill_id].present? && skill[:skill_id].to_s == skill_id.to_s
        end
        return exact_id_match if exact_id_match
      end

      normalized_label = normalize_label(label)
      portfolio_skills.find { |skill| normalize_label(skill[:skill_label]) == normalized_label }
    end

    def normalize_label(label)
      label.to_s.downcase.squish
    end
  end
end
