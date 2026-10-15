# frozen_string_literal: true

# generation_started_at lets a new job take over a portfolio whose worker died
# mid-run instead of leaving it stuck in 'generating' forever.
# input_fingerprint lets us tell when a fit/gap report no longer matches the
# levels and vacancy it was computed from (e.g. after an override).
# Both are nullable additions, so existing rows are untouched.
class AddJobTrackingToPortfoliosAndFitGapReports < ActiveRecord::Migration[7.0]
  def change
    add_column :portfolios, :generation_started_at, :datetime
    add_column :fit_gap_reports, :input_fingerprint, :string, limit: 64
  end
end
