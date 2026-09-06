# frozen_string_literal: true

class CreateCandidateConsents < ActiveRecord::Migration[7.0]
  def change
    create_table :candidate_consents do |t|
      t.bigint   :session_id,         null: false
      t.bigint   :tenant_id,          null: false
      t.string   :status,             null: false, default: 'pending'  # pending | granted | revoked
      t.string   :disclosure_version, null: false, default: '1.0'
      t.datetime :granted_at
      t.datetime :revoked_at
      t.string   :ip_address,         limit: 45
      t.string   :user_agent,         limit: 500
      t.datetime :created_at,         default: -> { 'now()' }
    end

    add_index :candidate_consents, :session_id, unique: true  # satu consent per session
    add_index :candidate_consents, :tenant_id

    add_check_constraint :candidate_consents,
      "status IN ('pending', 'granted', 'revoked')",
      name: 'chk_candidate_consents_status'
  end
end
