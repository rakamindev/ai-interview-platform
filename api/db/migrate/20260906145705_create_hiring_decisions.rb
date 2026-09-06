# frozen_string_literal: true

class CreateHiringDecisions < ActiveRecord::Migration[7.0]
  def change
    create_table :hiring_decisions do |t|
      t.bigint   :portfolio_id, null: false
      t.bigint   :decided_by,   null: false
      t.bigint   :tenant_id,    null: false
      t.string   :decision,     limit: 20,  null: false  # 'advance' | 'hold' | 'reject'
      t.text     :rationale,    null: false               # wajib — no hiding behind AI
      t.string   :ip_address,   limit: 45                # IPv6 max 45 chars
      t.string   :user_agent,   limit: 500
      t.datetime :decided_at,   default: -> { 'now()' }, null: false
    end

    add_index :hiring_decisions, :portfolio_id, unique: true  # satu keputusan per portfolio
    add_index :hiring_decisions, :tenant_id
    add_index :hiring_decisions, :decided_by

    add_check_constraint :hiring_decisions,
      "decision IN ('advance', 'hold', 'reject')",
      name: 'chk_hiring_decisions_decision'
  end
end
