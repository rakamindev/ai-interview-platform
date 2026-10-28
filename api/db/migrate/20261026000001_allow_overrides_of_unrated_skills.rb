# frozen_string_literal: true

# An assessor may rate a skill the interview never measured (with a note). Such an override has no
# AI level to record. The existing 1..5 check constraint still applies to non-NULL values.
class AllowOverridesOfUnratedSkills < ActiveRecord::Migration[7.0]
  def up
    change_column_null :assessor_overrides, :ai_level, true
  end

  def down
    unrated = select_value('SELECT COUNT(*) FROM assessor_overrides WHERE ai_level IS NULL').to_i
    if unrated.positive?
      raise ActiveRecord::IrreversibleMigration,
            "#{unrated} override(s) replace a skill that had no AI level. Delete them before rolling back."
    end

    change_column_null :assessor_overrides, :ai_level, false
  end
end
