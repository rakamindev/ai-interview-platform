# frozen_string_literal: true

# Adds an explicit lifecycle to candidate invite links.
#
# Before this migration an invite token was valid forever: it was generated once
# on session creation and never expired, could not be revoked, and kept working
# after the interview ended. That is a privacy problem (UU PDP) as much as a
# product one: a forwarded link gave permanent access to a candidate's interview.
class AddInviteLifecycleToSessions < ActiveRecord::Migration[7.0]
  def up
    add_column :sessions, :invite_expires_at, :datetime
    add_column :sessions, :invite_revoked_at, :datetime
    add_column :sessions, :consent_given_at, :datetime
    add_column :sessions, :invite_reissued_count, :integer, default: 0, null: false

    # Backfill is intentionally conservative: give existing links the same 72h
    # window a new link gets, measured from creation. Links older than 72h become
    # expired (the safer default) instead of being silently grandfathered forever.
    execute <<~SQL
      UPDATE ai_interview.sessions
      SET invite_expires_at = created_at + INTERVAL '72 hours'
      WHERE invite_expires_at IS NULL
    SQL

    change_column_null :sessions, :invite_expires_at, false
  end

  def down
    remove_column :sessions, :invite_reissued_count
    remove_column :sessions, :consent_given_at
    remove_column :sessions, :invite_revoked_at
    remove_column :sessions, :invite_expires_at
  end
end
