# frozen_string_literal: true

class AssessorOverride < ApplicationRecord
  belongs_to :portfolio_skill

  validates :ai_level,       numericality: { only_integer: true, in: 1..5 }
  validates :override_level, numericality: { only_integer: true, in: 1..5 }
  validates :overridden_by,  presence: true

  after_save :sync_fit_gap_reports

  private

  def sync_fit_gap_reports
    portfolio = portfolio_skill&.portfolio
    return unless portfolio

    FitGapReport.where(portfolio_id: portfolio.id).find_each do |report|
      FitGap::Engine.new(portfolio: portfolio, vacancy: report.vacancy).call
    end
  end
end

