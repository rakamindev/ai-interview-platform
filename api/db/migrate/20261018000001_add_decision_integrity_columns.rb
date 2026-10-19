# frozen_string_literal: true

class AddDecisionIntegrityColumns < ActiveRecord::Migration[7.0]
  def up
    add_column :portfolios, :generation_started_at, :datetime
    add_column :portfolios, :omitted_ratings, :jsonb, default: [], null: false
    add_column :portfolios, :job_claims, :jsonb, default: {}, null: false
    add_column :fit_gap_reports, :decision, :jsonb
  end

  def down
    remove_column :fit_gap_reports, :decision
    remove_column :portfolios, :job_claims
    remove_column :portfolios, :omitted_ratings
    remove_column :portfolios, :generation_started_at
  end
end
