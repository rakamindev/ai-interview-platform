# frozen_string_literal: true

class AllowUnassessedPortfolioLevels < ActiveRecord::Migration[7.0]
  def up
    change_column_null :portfolio_skills, :ai_level, true
    change_column_null :assessor_overrides, :ai_level, true
    add_column :sessions, :preparing_to_end_at, :datetime
  end

  def down
    # Never invent a rating to satisfy the old NOT NULL constraint on rollback.
    if select_value('SELECT EXISTS (SELECT 1 FROM portfolio_skills WHERE ai_level IS NULL)') ||
       select_value('SELECT EXISTS (SELECT 1 FROM assessor_overrides WHERE ai_level IS NULL)')
      raise ActiveRecord::IrreversibleMigration, 'Unassessed ratings exist; export/reconcile them before rollback.'
    end
    remove_column :sessions, :preparing_to_end_at
    change_column_null :assessor_overrides, :ai_level, false
    change_column_null :portfolio_skills, :ai_level, false
  end
end
