# frozen_string_literal: true

# Adds unique indexes on vacancy_skills and portfolio_skills by (parent_id, skill_label),
# and adds status + generation_error columns to fit_gap_reports.
#
# Each unique index is preceded by a duplicate pre-check that raises with the
# offending IDs rather than failing on the index at 3am.
class AddUniquenessAndFitgapStatus < ActiveRecord::Migration[7.0]
  disable_ddl_transaction!

  def up
    # ── vacancy_skills unique index ──────────────────────────────────────────
    duplicates = connection.select_all(<<~SQL.squish)
      SELECT vacancy_id, skill_label, array_agg(id) AS ids
      FROM ai_interview.vacancy_skills
      GROUP BY vacancy_id, skill_label
      HAVING count(*) > 1
    SQL

    if duplicates.any?
      msg = duplicates.map { |r| "vacancy_id=#{r['vacancy_id']} label=#{r['skill_label']} ids=#{r['ids']}" }.join("\n")
      raise ActiveRecord::IrreversibleMigration,
            "Duplicate vacancy_skills rows found — resolve before migrating:\n#{msg}"
    end

    add_index :vacancy_skills, [:vacancy_id, :skill_label],
              unique: true, name: "idx_vacancy_skills_uniq_label"

    # ── portfolio_skills unique index ────────────────────────────────────────
    duplicates = connection.select_all(<<~SQL.squish)
      SELECT portfolio_id, skill_label, array_agg(id) AS ids
      FROM ai_interview.portfolio_skills
      GROUP BY portfolio_id, skill_label
      HAVING count(*) > 1
    SQL

    if duplicates.any?
      msg = duplicates.map { |r| "portfolio_id=#{r['portfolio_id']} label=#{r['skill_label']} ids=#{r['ids']}" }.join("\n")
      raise ActiveRecord::IrreversibleMigration,
            "Duplicate portfolio_skills rows found — resolve before migrating:\n#{msg}"
    end

    add_index :portfolio_skills, [:portfolio_id, :skill_label],
              unique: true, name: "idx_portfolio_skills_uniq_label"

    # ── fit_gap_reports status columns ───────────────────────────────────────
    add_column :fit_gap_reports, :status,
               'ai_interview.generation_status', default: 'pending', null: false
    add_column :fit_gap_reports, :generation_error, :text
  end

  def down
    remove_column :fit_gap_reports, :generation_error
    remove_column :fit_gap_reports, :status
    remove_index :portfolio_skills, name: "idx_portfolio_skills_uniq_label"
    remove_index :vacancy_skills, name: "idx_vacancy_skills_uniq_label"
  end
end
