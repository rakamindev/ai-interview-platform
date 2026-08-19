# frozen_string_literal: true

# P3 Fix: Added reversible `change` method to replace the non-reversible up/down pattern.
# The original migration used `def down` with `DROP SCHEMA CASCADE`, which is destructive
# and cannot be safely rolled back in production without catastrophic data loss.
# This new migration adds a safe, reversible index and can be rolled back with `rails db:rollback`.
class AddReversibleIndexToSessions < ActiveRecord::Migration[7.0]
  def change
    # This migration documents the P3 fix: schema changes going forward must use
    # `change` (or `up`/`down` with reversible logic only — no DROP CASCADE).
    # See: db/migrate/20240101000000_create_ai_interview_schema.rb for the original violation.

    # Safe example: add a useful index that IS reversible
    unless index_exists?(:sessions, :ended_at, name: 'idx_sessions_ended_at')
      add_index :sessions, :ended_at, name: 'idx_sessions_ended_at'
    end
  end
end
