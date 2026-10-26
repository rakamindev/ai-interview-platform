# frozen_string_literal: true

require 'digest'

module FitGap
  # Everything a fit/gap report is computed from, loaded once. The digest
  # changes whenever anything that affects the report changes (an override,
  # a vacancy edit, a portfolio regeneration), which is how a report knows it
  # is outdated without being deleted.
  class Inputs
    attr_reader :portfolio, :vacancy

    def initialize(portfolio:, vacancy:)
      @portfolio = portfolio
      @vacancy = vacancy
    end

    def requirements
      @requirements ||= vacancy.vacancy_skills.order(:id).map do |skill|
        Comparator::Requirement.new(skill_id: skill.skill_id, skill_label: skill.skill_label,
                                    expected_level: skill.expected_level)
      end
    end

    def ratings
      @ratings ||= portfolio_skills.map do |skill|
        override = skill.assessor_override
        Comparator::Rating.new(
          skill_id: skill.skill_id, skill_label: skill.skill_label,
          ai_level: skill.ai_level, ai_confidence: skill.ai_confidence,
          override_level: override&.override_level, assessor_notes: override&.assessor_notes
        )
      end
    end

    # Competency summaries keyed by normalised label, for the narrative prompt.
    def competency_summaries
      @competency_summaries ||= portfolio_skills.to_h do |skill|
        [Comparator.normalize_label(skill.skill_label), skill.competency_summary]
      end
    end

    def digest
      @digest ||= Digest::SHA256.hexdigest({
        requirements: requirements.map(&:to_h),
        ratings: ratings.map(&:to_h),
        portfolio_generated_at: portfolio.generated_at&.utc&.iso8601(6),
        culture: [vacancy.role_title, vacancy.culture_dimensions, vacancy.competency_expectations]
      }.to_json)
    end

    private

    def portfolio_skills
      @portfolio_skills ||= portfolio.portfolio_skills.includes(:assessor_override).order(:id).to_a
    end
  end
end
