# frozen_string_literal: true

# Tracks whether a portfolio_skill's AI rating is current or stale.
# "stale" means the AI no longer returns this skill during regeneration,
# but the row is preserved because it has an assessor_override that must
# survive per UU PDP Art. 10.
class AddAiPresenceToPortfolioSkills < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def up
    execute <<~SQL.squish
      DO $$ BEGIN
        CREATE TYPE ai_interview.ai_presence AS ENUM ('current', 'stale');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    SQL

    add_column :portfolio_skills, :ai_presence,
               "ai_interview.ai_presence", default: "current", null: false
  end

  def down
    remove_column :portfolio_skills, :ai_presence
    execute "DROP TYPE IF EXISTS ai_interview.ai_presence"
  end
end
