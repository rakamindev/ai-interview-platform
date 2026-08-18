# frozen_string_literal: true

# Revises a Phase 6 scoping decision: entries didn't link back to the Session
# Inviter creates for them, since nothing needed that link yet. Phase 7's invite
# email does — it needs session.invite_url — so the link is added now rather than
# deferred to Phase 8 as originally planned.
#
# Also adds the tracking columns FR5's confirm-before-firing gate needs: a batch
# that resolves entirely one way at either layer (every entry auto-invited, or
# every entry auto-rejected) holds its notification emails for explicit recruiter
# confirmation instead of firing them immediately.
class AddMailerColumnsToCvScreening < ActiveRecord::Migration[7.0]
  def change
    add_reference :cv_screening_entries, :session, foreign_key: true, type: :bigint
    add_column :cv_screening_entries, :notified_at, :datetime

    add_column :cv_screening_batches, :notification_status, :string, null: false, default: 'pending'
  end
end
