# frozen_string_literal: true

# A portfolio skill can now be "not assessed": no level and no confidence,
# with a reason. Existing rows stay "assessed" and keep their level; the
# coverage snapshot is backfilled from coverage_maps where a match exists.
class AllowNotAssessedPortfolioSkills < ActiveRecord::Migration[7.0]
  REASONS = %w[not_covered no_level_from_model invalid_level_from_model no_evidence].freeze

  def up
    change_column_null :portfolio_skills, :ai_level, true
    change_column_null :portfolio_skills, :ai_confidence, true
    remove_check_constraint :portfolio_skills, name: 'chk_portfolio_skills_ai_level'
    add_check_constraint :portfolio_skills, 'ai_level IS NULL OR (ai_level >= 1 AND ai_level <= 5)',
                         name: 'chk_portfolio_skills_ai_level'

    add_column :portfolio_skills, :rating_status, :string, limit: 20, null: false, default: 'assessed'
    add_column :portfolio_skills, :not_assessed_reason, :string, limit: 40
    add_column :portfolio_skills, :coverage_state, :string, limit: 20
    add_column :portfolio_skills, :probe_count, :integer

    add_check_constraint :portfolio_skills, "rating_status IN ('assessed', 'not_assessed')",
                         name: 'chk_portfolio_skills_rating_status'
    add_check_constraint :portfolio_skills,
                         "not_assessed_reason IS NULL OR not_assessed_reason IN (#{REASONS.map { |r| "'#{r}'" }.join(', ')})",
                         name: 'chk_portfolio_skills_not_assessed_reason'
    add_check_constraint :portfolio_skills, <<~SQL.squish, name: 'chk_portfolio_skills_rating_consistency'
      (rating_status = 'assessed' AND ai_level IS NOT NULL AND ai_confidence IS NOT NULL
        AND not_assessed_reason IS NULL)
      OR (rating_status = 'not_assessed' AND ai_level IS NULL AND ai_confidence IS NULL
        AND not_assessed_reason IS NOT NULL)
    SQL

    backfill_coverage_snapshot
  end

  def down
    count = select_value('SELECT COUNT(*) FROM portfolio_skills WHERE ai_level IS NULL OR ai_confidence IS NULL').to_i
    if count.positive?
      raise ActiveRecord::IrreversibleMigration,
            "#{count} not-assessed portfolio skills exist; rolling back would have to invent a level for them"
    end

    remove_check_constraint :portfolio_skills, name: 'chk_portfolio_skills_rating_consistency'
    remove_check_constraint :portfolio_skills, name: 'chk_portfolio_skills_not_assessed_reason'
    remove_check_constraint :portfolio_skills, name: 'chk_portfolio_skills_rating_status'
    remove_column :portfolio_skills, :probe_count
    remove_column :portfolio_skills, :coverage_state
    remove_column :portfolio_skills, :not_assessed_reason
    remove_column :portfolio_skills, :rating_status

    remove_check_constraint :portfolio_skills, name: 'chk_portfolio_skills_ai_level'
    add_check_constraint :portfolio_skills, 'ai_level >= 1 AND ai_level <= 5', name: 'chk_portfolio_skills_ai_level'
    change_column_null :portfolio_skills, :ai_confidence, false
    change_column_null :portfolio_skills, :ai_level, false
  end

  private

  def backfill_coverage_snapshot
    execute <<~SQL.squish
      UPDATE portfolio_skills ps
      SET coverage_state = cm.state::text, probe_count = cm.probe_count
      FROM portfolios p, coverage_maps cm
      WHERE ps.portfolio_id = p.id
        AND cm.session_id = p.session_id
        AND cm.is_discovered = ps.is_discovered
        AND ((ps.skill_id IS NOT NULL AND cm.skill_id = ps.skill_id)
          OR lower(btrim(cm.skill_label)) = lower(btrim(ps.skill_label)))
    SQL
  end
end
