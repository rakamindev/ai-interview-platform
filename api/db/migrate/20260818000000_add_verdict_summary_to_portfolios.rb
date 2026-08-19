# frozen_string_literal: true

class AddVerdictSummaryToPortfolios < ActiveRecord::Migration[7.0]
  def change
    add_column :portfolios, :verdict_summary, :text
  end
end
