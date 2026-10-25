# frozen_string_literal: true

class AddTenantIdToPortfolioSkills < ActiveRecord::Migration[7.0]
  def up
    # 1. Add column (nullable initially for backfill)
    add_column :portfolio_skills, :tenant_id, :bigint

    # 2. Backfill tenant_id from portfolio.tenant_id
    execute <<~SQL
      UPDATE portfolio_skills
      SET tenant_id = portfolios.tenant_id
      FROM portfolios
      WHERE portfolio_skills.portfolio_id = portfolios.id
    SQL

    # 3. Verify backfill (all rows must have tenant_id)
    null_count = execute("SELECT COUNT(*) FROM portfolio_skills WHERE tenant_id IS NULL").first['count'].to_i
    raise "Backfill failed: #{null_count} portfolio_skills still have NULL tenant_id" if null_count > 0

    # 4. Add NOT NULL constraint
    change_column_null :portfolio_skills, :tenant_id, false

    # 5. Add foreign key and index
    add_foreign_key :portfolio_skills, :organizations, column: :tenant_id
    add_index :portfolio_skills, :tenant_id
  end

  def down
    remove_foreign_key :portfolio_skills, :organizations
    remove_index :portfolio_skills, :tenant_id
    remove_column :portfolio_skills, :tenant_id
  end
end
