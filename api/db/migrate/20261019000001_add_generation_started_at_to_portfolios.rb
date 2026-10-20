# frozen_string_literal: true

class AddGenerationStartedAtToPortfolios < ActiveRecord::Migration[7.0]
  def change
    add_column :portfolios, :generation_started_at, :datetime
  end
end
