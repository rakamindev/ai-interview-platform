# frozen_string_literal: true

# Adds candidate_email for cross-session identity (primary: candidate_id,
# secondary: candidate_email, fallback: session_id — name is display-only).
# Also adds 'superseded' to the end_reason enum so pending sessions that
# are made irrelevant by a later completed session can be distinguished
# from genuine failures.
class AddCandidateIdentityToSessions < ActiveRecord::Migration[7.0]
  def up
    # 1. Add candidate_email (nullable — email is optional but preferred)
    add_column :sessions, :candidate_email, :string, limit: 255

    # 2. Add 'superseded' to the end_reason PG enum
    execute "ALTER TYPE end_reason ADD VALUE IF NOT EXISTS 'superseded'"
  end

  def down
    remove_column :sessions, :candidate_email

    # NOTE: removing a PG enum value requires dropping and re-creating the type,
    # which is destructive. Leave the enum value in place on rollback — it is
    # harmless if unused. Document this explicitly rather than silently skipping.
    Rails.logger.warn("[Migration] Cannot remove 'superseded' from end_reason enum safely. Skipping.")
  end
end
