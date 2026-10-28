# frozen_string_literal: true

# Makes assessor overrides durable and auditable:
# - portfolio_skills.skill_key: a stable identity (skill id, else normalised
#   label) so regeneration can update skills in place instead of deleting
#   them together with their overrides
# - assessor_override_events: append-only history of set / revert / confirm,
#   backfilled with one "set" event per existing override
# - assessor_overrides: ai_level may be empty (override on a not-assessed
#   skill), optimistic locking, and a required note for every new write
class AddOverrideHistory < ActiveRecord::Migration[7.0]
  LEGACY_NOTE = '[legacy override, no note recorded]'

  def up
    add_skill_key
    create_override_events
    backfill_override_events

    change_column_null :assessor_overrides, :ai_level, true
    remove_check_constraint :assessor_overrides, name: 'chk_overrides_ai_level'
    add_check_constraint :assessor_overrides, 'ai_level IS NULL OR (ai_level >= 1 AND ai_level <= 5)',
                         name: 'chk_overrides_ai_level'
    add_column :assessor_overrides, :lock_version, :integer, null: false, default: 0
    # NOT VALID: legacy rows without a note are tolerated; every new write is checked.
    add_check_constraint :assessor_overrides,
                         "assessor_notes IS NOT NULL AND length(btrim(assessor_notes)) > 0",
                         name: 'chk_overrides_notes_present', validate: false
  end

  def down
    nulls = select_value('SELECT COUNT(*) FROM assessor_overrides WHERE ai_level IS NULL').to_i
    if nulls.positive?
      raise ActiveRecord::IrreversibleMigration,
            "#{nulls} overrides on not-assessed skills exist; rolling back would have to invent an AI level"
    end

    remove_check_constraint :assessor_overrides, name: 'chk_overrides_notes_present'
    remove_column :assessor_overrides, :lock_version
    remove_check_constraint :assessor_overrides, name: 'chk_overrides_ai_level'
    add_check_constraint :assessor_overrides, 'ai_level >= 1 AND ai_level <= 5', name: 'chk_overrides_ai_level'
    change_column_null :assessor_overrides, :ai_level, false

    drop_table :assessor_override_events
    remove_index :portfolio_skills, name: 'index_portfolio_skills_on_identity'
    remove_column :portfolio_skills, :skill_key
  end

  private

  def add_skill_key
    add_column :portfolio_skills, :skill_key, :string, limit: 300
    execute <<~SQL.squish
      UPDATE portfolio_skills SET skill_key = CASE
        WHEN skill_id IS NOT NULL AND btrim(skill_id) <> '' THEN 'id:' || lower(btrim(skill_id))
        ELSE 'label:' || lower(regexp_replace(btrim(skill_label), '\\s+', ' ', 'g'))
      END
    SQL

    duplicates = select_value(<<~SQL.squish).to_i
      SELECT COUNT(*) FROM (
        SELECT 1 FROM portfolio_skills GROUP BY portfolio_id, is_discovered, skill_key HAVING COUNT(*) > 1
      ) dup
    SQL
    if duplicates.positive?
      raise "#{duplicates} groups of duplicate skill keys found in portfolio_skills; " \
            'resolve them before migrating (no automatic merge)'
    end

    change_column_null :portfolio_skills, :skill_key, false
    add_index :portfolio_skills, %i[portfolio_id is_discovered skill_key], unique: true,
                                                                             name: 'index_portfolio_skills_on_identity'
  end

  def create_override_events
    create_table :assessor_override_events do |t|
      t.references :portfolio_skill, null: false, foreign_key: true, index: false
      t.string  :action, limit: 20, null: false
      t.integer :from_level
      t.integer :to_level
      t.integer :ai_level_at_time
      t.text    :notes
      t.bigint  :actor_id, null: false
      t.datetime :created_at, null: false, default: -> { 'now()' }

      t.index %i[portfolio_skill_id created_at], name: 'index_override_events_on_skill_and_time'
      t.check_constraint "action IN ('set', 'revert', 'confirm')", name: 'chk_override_events_action'
      t.check_constraint "action = 'confirm' OR (notes IS NOT NULL AND length(btrim(notes)) > 0)",
                         name: 'chk_override_events_notes'
      %w[from_level to_level ai_level_at_time].each do |column|
        t.check_constraint "#{column} IS NULL OR (#{column} >= 1 AND #{column} <= 5)",
                           name: "chk_override_events_#{column}"
      end
    end
  end

  def backfill_override_events
    execute <<~SQL.squish
      INSERT INTO assessor_override_events
        (portfolio_skill_id, action, from_level, to_level, ai_level_at_time, notes, actor_id, created_at)
      SELECT portfolio_skill_id, 'set', ai_level, override_level, ai_level,
             COALESCE(NULLIF(btrim(assessor_notes), ''), #{quote(LEGACY_NOTE)}),
             overridden_by, COALESCE(overridden_at, now())
      FROM assessor_overrides
    SQL
  end
end
