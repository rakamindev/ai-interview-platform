# frozen_string_literal: true

class TrackPortfolioGenerationAttempts < ActiveRecord::Migration[7.0]
  def change
    add_column :portfolios, :generation_attempt_token, :string, limit: 64
    add_column :portfolios, :generation_attempted_at, :datetime
  end
end
