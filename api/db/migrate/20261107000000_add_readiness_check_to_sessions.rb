# frozen_string_literal: true

# Stores the candidate's pre-interview readiness result (network/mic checks).
# Nullable with no default: existing rows stay NULL, PostgreSQL adds the column
# without rewriting the table, and `change` makes the migration reversible.
class AddReadinessCheckToSessions < ActiveRecord::Migration[7.0]
  def change
    add_column :sessions, :readiness_check, :jsonb
  end
end
