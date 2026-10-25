# frozen_string_literal: true

class PortfolioRevision < ApplicationRecord
  belongs_to :portfolio

  validates :version, presence: true, uniqueness: { scope: :portfolio_id }
  validates :snapshot, presence: true

  scope :newest_first, -> { order(version: :desc) }

  def self.capture!(portfolio)
    create!(
      portfolio: portfolio,
      version: where(portfolio_id: portfolio.id).maximum(:version).to_i + 1,
      generation_status: portfolio.generation_status,
      generated_at: portfolio.generated_at,
      generation_error: portfolio.generation_error,
      snapshot: {
        skills: portfolio.portfolio_skills.map do |skill|
          {
            id: skill.id,
            skill_id: skill.skill_id,
            skill_label: skill.skill_label,
            is_discovered: skill.is_discovered,
            ai_level: skill.ai_level,
            ai_confidence: skill.ai_confidence,
            evidence: skill.evidence,
            competency_summary: skill.competency_summary
          }
        end,
        overrides: portfolio.assessor_overrides.map do |override|
          {
            id: override.id,
            portfolio_skill_id: override.portfolio_skill_id,
            ai_level: override.ai_level,
            override_level: override.override_level,
            assessor_notes: override.assessor_notes,
            overridden_by: override.overridden_by,
            overridden_at: override.overridden_at
          }
        end
      }
    )
  end
end
