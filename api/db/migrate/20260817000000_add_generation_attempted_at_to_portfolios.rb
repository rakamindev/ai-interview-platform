# frozen_string_literal: true

class AddGenerationAttemptedAtToPortfolios < ActiveRecord::Migration[7.0]
  def up
    add_column :portfolios, :generation_attempted_at, :datetime, precision: 6
  end

  def down
    remove_column :portfolios, :generation_attempted_at
  end
end