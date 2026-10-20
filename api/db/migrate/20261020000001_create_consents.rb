# frozen_string_literal: true

class CreateConsents < ActiveRecord::Migration[7.0]
  def change
    # tenant_id deliberately absent: a consent is always reached through its
    # session, which is already tenant scoped. The candidate-facing endpoints
    # authenticate with an invite token and never resolve a tenant.
    #
    # index: false because the unique index below replaces the default
    # non-unique one that `t.references` would otherwise create.
    create_table :consents do |t|
      t.references :session, null: false, foreign_key: true, index: false
      t.string     :version,     null: false
      t.datetime   :consented_at, null: false
      t.timestamps
    end

    # One consent per session. The uniqueness is what makes two concurrent
    # POSTs collapse into a single record instead of two, and it is what lets
    # the endpoint be idempotent without an extra read.
    #
    # Deliberately no ip_address or user_agent: they would be personal data
    # collected beyond what consent needs to prove, which cuts against the
    # limited-collection principle in UU PDP Pasal 16(2)(a).
    add_index :consents, :session_id, unique: true, name: "idx_consents_session_id_unique"
  end
end
