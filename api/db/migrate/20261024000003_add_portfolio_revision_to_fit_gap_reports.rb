# frozen_string_literal: true

class AddPortfolioRevisionToFitGapReports < ActiveRecord::Migration[7.0]
  def change
    add_reference :fit_gap_reports, :portfolio_revision, foreign_key: true
  end
end
