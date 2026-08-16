# frozen_string_literal: true

# Candidate consent records — one row per session (unique), records the
# disclosure version granted/revoked plus audit metadata (ip, user_agent).
class CreateConsents < ActiveRecord::Migration[7.0]
  def up
    create_table :consents, id: :uuid do |t|
      t.bigint   :session_id, null: false
      t.string   :version, limit: 64, null: false
      t.string   :status, limit: 20, null: false, default: 'granted'
      t.datetime :granted_at, null: false
      t.datetime :revoked_at
      t.string   :ip, limit: 64
      t.string   :user_agent, limit: 255
      t.bigint   :tenant_id, null: false
      t.timestamps
    end

    add_index :consents, :session_id, unique: true
    add_index :consents, :tenant_id
    add_foreign_key :consents, :sessions
  end

  def down
    drop_table :consents
  end
end