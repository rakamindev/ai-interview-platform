# frozen_string_literal: true

# G1: a skill the AI did not rate validly is stored as "Not rated" (ai_level NULL + a reason) instead
# of being coerced to L1, and every quote carries a textual-provenance check. Existing rows keep
# their values; nothing is backfilled or reinterpreted.
class AddEvidenceIntegrityToPortfolioSkills < ActiveRecord::Migration[7.0]
  def up
    change_column_null :portfolio_skills, :ai_level, true
    add_column :portfolio_skills, :ai_level_reason, :string # missing_level | invalid_level | ai_omitted
    add_column :portfolio_skills, :evidence_checks, :jsonb, null: false, default: []
    # An assessor may override a Not rated skill, so the AI level they saw can be NULL too.
    change_column_null :assessor_overrides, :ai_level, true
  end

  def down
    # Never coerce "Not rated" back into a fake level: refuse while such rows exist.
    unrated = select_value('SELECT count(*) FROM portfolio_skills WHERE ai_level IS NULL').to_i +
              select_value('SELECT count(*) FROM assessor_overrides WHERE ai_level IS NULL').to_i
    if unrated.positive?
      raise ActiveRecord::IrreversibleMigration,
            "#{unrated} Not rated rows exist; rolling back would require inventing a level for them."
    end

    change_column_null :assessor_overrides, :ai_level, false
    remove_column :portfolio_skills, :evidence_checks
    remove_column :portfolio_skills, :ai_level_reason
    change_column_null :portfolio_skills, :ai_level, false
  end
end
