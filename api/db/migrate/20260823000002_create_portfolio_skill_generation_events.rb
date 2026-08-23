# frozen_string_literal: true

# Append-only audit trail for AI generation lifecycle events on portfolio skills.
# Mirrors the assessor_override_events pattern: Postgres triggers prevent
# UPDATE and DELETE so the table is strictly append-only.
class CreatePortfolioSkillGenerationEvents < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def up
    execute <<~SQL.squish
      DO $$ BEGIN
        CREATE TYPE ai_interview.generation_event_type AS ENUM ('stale_marked', 'restored');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    SQL

    create_table :portfolio_skill_generation_events do |t|
      t.bigint   :portfolio_skill_id, null: false
      t.bigint   :tenant_id,          null: false
      t.enum     :event_type,         null: false, enum_type: "ai_interview.generation_event_type"
      t.text     :reason
      t.datetime :created_at,         precision: 6, null: false, default: -> { "NOW()" }
    end

    add_index :portfolio_skill_generation_events, :tenant_id
    add_index :portfolio_skill_generation_events, :portfolio_skill_id

    execute <<~SQL.squish
      CREATE OR REPLACE FUNCTION prevent_generation_event_modification()
      RETURNS TRIGGER AS $$
      BEGIN
        RAISE EXCEPTION 'portfolio_skill_generation_events is append-only — UPDATE and DELETE are forbidden';
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER trg_no_generation_event_update
        BEFORE UPDATE ON ai_interview.portfolio_skill_generation_events
        FOR EACH ROW EXECUTE FUNCTION prevent_generation_event_modification();

      CREATE TRIGGER trg_no_generation_event_delete
        BEFORE DELETE ON ai_interview.portfolio_skill_generation_events
        FOR EACH ROW EXECUTE FUNCTION prevent_generation_event_modification();
    SQL
  end

  def down
    execute "DROP TRIGGER IF EXISTS trg_no_generation_event_delete ON ai_interview.portfolio_skill_generation_events"
    execute "DROP TRIGGER IF EXISTS trg_no_generation_event_update ON ai_interview.portfolio_skill_generation_events"
    execute "DROP FUNCTION IF EXISTS prevent_generation_event_modification()"
    drop_table :portfolio_skill_generation_events
    execute "DROP TYPE IF EXISTS ai_interview.generation_event_type"
  end
end
