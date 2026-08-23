# frozen_string_literal: true

class NormalizePortfolioDecisionFinalizerColumn < ActiveRecord::Migration[7.0]
  def up
    return unless column_exists?(:portfolio_decisions, :finalized_by)
    return if column_exists?(:portfolio_decisions, :finalized_by_id)

    rename_column :portfolio_decisions, :finalized_by, :finalized_by_id
  end

  def down
    return unless column_exists?(:portfolio_decisions, :finalized_by_id)

    rename_column :portfolio_decisions, :finalized_by_id, :finalized_by
  end
end
