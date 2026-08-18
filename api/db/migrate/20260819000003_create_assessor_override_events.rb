# frozen_string_literal: true

# Append-only audit trail for assessor overrides.
# Under UU PDP Art. 10 the assessor override is what keeps a hiring rating
# out of "solely automated" territory — so an unauditable override means
# the operator cannot demonstrate a human was ever meaningfully involved.
#
# Backfills one event per existing override so history starts complete.
class CreateAssessorOverrideEvents < ActiveRecord::Migration[7.0]
  disable_ddl_transaction!

  def up
    create_table :assessor_override_events do |t|
      t.bigint   :tenant_id,         null: false
      t.bigint   :portfolio_skill_id, null: false
      t.integer  :ai_level,          null: false
      t.integer  :override_level,    null: false
      t.text     :assessor_notes
      t.bigint   :overridden_by,     null: false
      t.datetime :overridden_at,     precision: 6
      t.datetime :created_at,        precision: 6, null: false, default: -> { "NOW()" }
    end

    add_index :assessor_override_events, :tenant_id
    add_index :assessor_override_events, :portfolio_skill_id

    # Backfill one event per existing override
    backfill_events

    # Enforce append-only at the Postgres level
    execute <<~SQL.squish
      CREATE OR REPLACE FUNCTION prevent_override_event_modification()
      RETURNS TRIGGER AS $$
      BEGIN
        RAISE EXCEPTION 'assessor_override_events is append-only — UPDATE and DELETE are forbidden';
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER trg_no_override_event_update
        BEFORE UPDATE ON ai_interview.assessor_override_events
        FOR EACH ROW EXECUTE FUNCTION prevent_override_event_modification();

      CREATE TRIGGER trg_no_override_event_delete
        BEFORE DELETE ON ai_interview.assessor_override_events
        FOR EACH ROW EXECUTE FUNCTION prevent_override_event_modification();
    SQL
  end

  def down
    execute "DROP TRIGGER IF EXISTS trg_no_override_event_delete ON ai_interview.assessor_override_events"
    execute "DROP TRIGGER IF EXISTS trg_no_override_event_update ON ai_interview.assessor_override_events"
    execute "DROP FUNCTION IF EXISTS prevent_override_event_modification()"
    drop_table :assessor_override_events
  end

  private

  def backfill_events
    say_with_time "backfill one event per existing override" do
      execute <<~SQL.squish
        INSERT INTO ai_interview.assessor_override_events
          (tenant_id, portfolio_skill_id, ai_level, override_level, assessor_notes,
           overridden_by, overridden_at, created_at)
        SELECT
          ao.tenant_id, ao.portfolio_skill_id, ao.ai_level, ao.override_level,
          ao.assessor_notes, ao.overridden_by, ao.overridden_at,
          COALESCE(ao.overridden_at, NOW())
        FROM ai_interview.assessor_overrides ao
      SQL
    end
  end
end
