# frozen_string_literal: true

class AssessorOverride < ApplicationRecord
  belongs_to :portfolio_skill

  validates :ai_level,       numericality: { only_integer: true, in: 1..5 }
  validates :override_level, numericality: { only_integer: true, in: 1..5 }
  validates :overridden_by,  presence: true

  after_commit :invalidate_fit_gap_reports

  private

  def invalidate_fit_gap_reports
    skill = PortfolioSkill.unscoped.find_by(id: portfolio_skill_id)
    return unless skill

    portfolio = Portfolio.unscoped.find_by(id: skill.portfolio_id)
    return unless portfolio

    FitGap::RegenerationCoordinator.invalidate_portfolio!(
      portfolio_id: portfolio.id,
      tenant_id: portfolio.tenant_id
    )
  end
end
