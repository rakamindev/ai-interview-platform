# frozen_string_literal: true

require 'digest'

module FitGap
  class SourceFingerprint
    Snapshot = Struct.new(:data, :fingerprint, keyword_init: true)

    def self.call(portfolio:, vacancy:)
      new(portfolio:, vacancy:).call
    end

    def initialize(portfolio:, vacancy:)
      @portfolio = portfolio
      @vacancy = vacancy
    end

    def call
      validate_tenant!
      data = canonical_data
      Snapshot.new(data:, fingerprint: Digest::SHA256.hexdigest(JSON.generate(data)))
    end

    private

    def validate_tenant!
      return if @portfolio.tenant_id == @vacancy.tenant_id

      raise ArgumentError, 'Portfolio and vacancy must belong to the same tenant'
    end

    def canonical_data
      {
        portfolio: {
          id: @portfolio.id,
          skills: canonical_portfolio_skills
        },
        vacancy: {
          id: @vacancy.id,
          role_title: @vacancy.role_title.to_s,
          culture_dimensions: @vacancy.culture_dimensions.to_s,
          competency_expectations: @vacancy.competency_expectations.to_s,
          skills: canonical_vacancy_skills
        }
      }
    end

    def canonical_portfolio_skills
      @portfolio.portfolio_skills.includes(:assessor_override).map do |skill|
        override = skill.assessor_override
        {
          id: skill.id,
          skill_id: skill.skill_id,
          skill_label: skill.skill_label,
          ai_level: skill.ai_level,
          confidence: skill.ai_confidence,
          effective_level: override&.override_level || skill.ai_level,
          override: override && {
            id: override.id,
            level: override.override_level,
            overridden_at: override.overridden_at&.iso8601(6)
          }
        }
      end.sort_by { |skill| [skill[:skill_id].to_s, skill[:skill_label].downcase, skill[:id]] }
    end

    def canonical_vacancy_skills
      @vacancy.vacancy_skills.map do |skill|
        {
          id: skill.id,
          skill_id: skill.skill_id,
          skill_label: skill.skill_label,
          expected_level: skill.expected_level
        }
      end.sort_by { |skill| [skill[:skill_id].to_s, skill[:skill_label].downcase, skill[:id]] }
    end
  end
end
