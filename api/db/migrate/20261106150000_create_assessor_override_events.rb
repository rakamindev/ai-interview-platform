# frozen_string_literal: true

# F-05: riwayat override append-only. Tabel assessor_overrides tetap menjadi
# "state terkini"; tabel ini mencatat setiap perubahan (siapa, kapan, dari → ke, alasan).
#
# Aman untuk data lama: setiap override yang sudah ada di-backfill menjadi event
# pertama dengan legacy = true dan reason NULL bila alasan lama kosong.
# Reversible: down hanya menghapus tabel ini; assessor_overrides tidak disentuh.
class CreateAssessorOverrideEvents < ActiveRecord::Migration[7.0]
  def up
    create_table :assessor_override_events do |t|
      # Cascade di level database: bila portfolio_skill dihapus (regenerasi portofolio
      # berstatus failed), riwayatnya ikut terhapus tanpa melewati model.
      t.references :portfolio_skill, null: false, index: false,
                                     foreign_key: { on_delete: :cascade }
      t.integer  :previous_level, null: false
      t.integer  :new_level,      null: false
      t.integer  :ai_level,       null: false
      t.text     :reason
      t.bigint   :actor_id,       null: false
      t.boolean  :legacy,         null: false, default: false
      t.datetime :created_at,     null: false, default: -> { 'now()' }
    end

    add_index :assessor_override_events, %i[portfolio_skill_id created_at],
              name: 'idx_override_events_skill_created'

    add_check_constraint :assessor_override_events,
                         'previous_level BETWEEN 1 AND 5 AND new_level BETWEEN 1 AND 5 AND ai_level BETWEEN 1 AND 5',
                         name: 'chk_override_events_levels'

    execute <<~SQL.squish
      INSERT INTO assessor_override_events
        (portfolio_skill_id, previous_level, new_level, ai_level, reason, actor_id, legacy, created_at)
      SELECT portfolio_skill_id, ai_level, override_level, ai_level,
             NULLIF(BTRIM(assessor_notes), ''), overridden_by, TRUE, COALESCE(overridden_at, NOW())
      FROM assessor_overrides
    SQL
  end

  def down
    drop_table :assessor_override_events
  end
end
