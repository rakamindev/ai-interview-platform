# frozen_string_literal: true

module FitGap
  class Engine
    def initialize(portfolio:, vacancy:)
      @portfolio = portfolio
      @vacancy = vacancy
    end

    def call
      @portfolio.with_lock do
        @vacancy.reload
        tenant_id = Session.unscoped.where(id: @portfolio.session_id).pick(:tenant_id)
        unless tenant_id && tenant_id == @vacancy.tenant_id
          raise ArgumentError, 'Portfolio and vacancy must belong to the same tenant'
        end
        raise ArgumentError, 'Portfolio is not ready' unless @portfolio.complete?

        comparisons = Comparison.new(requirements: requirements, skills: skills).call
        report = FitGapReport.find_or_initialize_by(portfolio_id: @portfolio.id, vacancy_id: @vacancy.id)
        report.assign_attributes(
          skill_comparisons: comparisons.map(&:stringify_keys),
          culture_narrative: nil,
          overall_narrative: summary(comparisons)
        )
        if report.new_record? || report.changed?
          report.generated_at = Time.current
          report.save!
        end
        report
      end
    end

    private

    def requirements
      @vacancy.vacancy_skills.reload.order(:id).map do |skill|
        { id: skill.id, skill_id: skill.skill_id, skill_label: skill.skill_label, expected_level: skill.expected_level }
      end
    end

    def skills
      @portfolio.portfolio_skills.reload.includes(:assessor_override).map do |skill|
        override = skill.assessor_override
        {
          id: skill.id, skill_id: skill.skill_id, skill_label: skill.skill_label,
          ai_level: skill.ai_level, confidence: skill.ai_confidence,
          override_level_present: !override.nil?, override_level: override&.override_level
        }
      end
    end

    def summary(comparisons)
      counts = comparisons.group_by { |row| row[:result] }.transform_values(&:size)
      "#{counts.fetch('match', 0)} match, #{counts.fetch('exceed', 0)} above requirement, " \
        "#{counts.fetch('gap', 0)} below requirement, #{counts.fetch('not_assessed', 0)} not assessed. " \
        'Missing assessment is not a skill gap. Review interview evidence before making a hiring decision.'
    end
  end
end
