# frozen_string_literal: true

# Candidate-side progress so an interview can be resumed after a refresh,
# a closed tab, or a dropped connection.
#
# The Gemini side already survives a browser drop (see AudioWebSocketMiddleware
# BROWSER_GRACE_PERIOD + gemini_resumption_token). What was missing is the
# candidate's own progress through the pre-interview steps, so a refresh does
# not send them back to consent + device check.
class AddCandidateProgressToSessions < ActiveRecord::Migration[7.0]
  def change
    add_column :sessions, :candidate_stage, :string, limit: 20, default: 'welcome', null: false
    add_column :sessions, :consent_accepted_at, :datetime
    add_column :sessions, :device_check_passed_at, :datetime
    add_column :sessions, :last_seen_at, :datetime
    add_column :sessions, :resume_count, :integer, default: 0, null: false

    add_index :sessions, %i[tenant_id created_at], name: 'idx_sessions_tenant_created'

    reversible do |dir|
      dir.up do
        # Existing live/ended sessions are past the pre-interview steps.
        execute <<~SQL.squish
          UPDATE sessions SET candidate_stage = 'live'     WHERE status = 'active';
          UPDATE sessions SET candidate_stage = 'complete' WHERE status IN ('ended', 'failed');
        SQL
      end
    end
  end
end
