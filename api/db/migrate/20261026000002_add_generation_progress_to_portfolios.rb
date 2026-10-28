# frozen_string_literal: true

# Lets the API report retries in progress and detect a generation that stalled.
class AddGenerationProgressToPortfolios < ActiveRecord::Migration[7.0]
  def change
    add_column :portfolios, :generation_attempts, :integer, null: false, default: 0
    add_column :portfolios, :generation_started_at, :datetime
  end
end
