# frozen_string_literal: true

# Lets a skill in a report say "not assessed" or "could not be evaluated"
# instead of holding a made-up level.
class AddStatusToPortfolioSkills < ActiveRecord::Migration[7.0]
  def up
    add_column :portfolio_skills, :status, :string, null: false, default: 'assessed'
    add_column :portfolio_skills, :caveat, :string
    add_column :portfolio_skills, :coverage_state, :enum, enum_type: :coverage_state
    add_column :portfolio_skills, :probe_count, :integer
    add_column :portfolio_skills, :raw_level, :string

    change_column_null :portfolio_skills, :ai_level, true
    change_column_null :portfolio_skills, :ai_confidence, true
    change_column_null :portfolio_skills, :competency_summary, true

    add_check_constraint :portfolio_skills,
                         "status IN ('assessed', 'thin_evidence', 'not_assessed', 'unavailable')",
                         name: 'chk_portfolio_skills_status'
    add_check_constraint :portfolio_skills,
                         "status NOT IN ('assessed', 'thin_evidence') OR ai_level IS NOT NULL",
                         name: 'chk_portfolio_skills_rated_level'

    backfill_from_coverage

    # From now on every new row must say its status. Nothing is "assessed" by default.
    change_column_default :portfolio_skills, :status, from: 'assessed', to: nil
  end

  def down
    # The old table can't hold a skill without a level. These rows never have
    # a review, because a review needs a level, so they are removed.
    execute 'DELETE FROM portfolio_skills WHERE ai_level IS NULL'
    execute "UPDATE portfolio_skills SET ai_confidence = 'low' WHERE ai_confidence IS NULL"
    execute "UPDATE portfolio_skills SET competency_summary = '' WHERE competency_summary IS NULL"

    remove_check_constraint :portfolio_skills, name: 'chk_portfolio_skills_rated_level'
    remove_check_constraint :portfolio_skills, name: 'chk_portfolio_skills_status'

    change_column_null :portfolio_skills, :competency_summary, false
    change_column_null :portfolio_skills, :ai_confidence, false
    change_column_null :portfolio_skills, :ai_level, false

    remove_column :portfolio_skills, :raw_level
    remove_column :portfolio_skills, :probe_count
    remove_column :portfolio_skills, :coverage_state
    remove_column :portfolio_skills, :caveat
    remove_column :portfolio_skills, :status
  end

  private

  # Existing reports: match each skill to its session's coverage by name.
  # Old levels stay in the table, but a skill that was never discussed is no
  # longer marked as assessed.
  def backfill_from_coverage
    execute <<~SQL
      UPDATE portfolio_skills ps
      SET coverage_state = cm.state,
          probe_count    = cm.probe_count,
          status = CASE
            WHEN cm.state = 'not_yet' THEN 'not_assessed'
            WHEN cm.last_signal LIKE 'Auto-advanced%' OR cm.probe_count <= 1 THEN 'thin_evidence'
            ELSE 'assessed'
          END,
          caveat = CASE
            WHEN cm.state = 'not_yet' THEN NULL
            WHEN cm.last_signal LIKE 'Auto-advanced%' THEN 'auto_advanced'
            WHEN cm.probe_count <= 1 THEN 'low_probe_count'
          END
      FROM portfolios p
      JOIN coverage_maps cm ON cm.session_id = p.session_id
      WHERE ps.portfolio_id = p.id
        AND lower(cm.skill_label) = lower(ps.skill_label)
    SQL
  end
end
