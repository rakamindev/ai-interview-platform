# frozen_string_literal: true

# The pre-existing `sessions.candidate_id` column was never populated by any
# code path (frontend never sent it, controller only ever set candidate_name)
# — it's dead data, not a real reference. This migration drops it and adds a
# real FK to the new `candidates` table, backfilling one Candidate per
# existing session from `candidate_name` (no email was ever collected
# historically, so a placeholder is synthesized per session — these rows are
# not deduped, only newly created candidates going forward are).
class LinkSessionsToCandidates < ActiveRecord::Migration[7.0]
  class MigrationCandidate < ActiveRecord::Base
    self.table_name = 'candidates'
  end

  class MigrationSession < ActiveRecord::Base
    self.table_name = 'sessions'
  end

  def up
    remove_column :sessions, :candidate_id, :bigint
    add_column :sessions, :candidate_id, :bigint
    add_index :sessions, :candidate_id
    add_foreign_key :sessions, :candidates

    MigrationSession.reset_column_information
    MigrationSession.where.not(candidate_name: nil).find_each do |session|
      candidate = MigrationCandidate.create!(
        tenant_id: session.tenant_id,
        email: "legacy-session-#{session.id}@placeholder.local",
        name: session.candidate_name
      )
      session.update_column(:candidate_id, candidate.id)
    end
  end

  def down
    remove_foreign_key :sessions, :candidates
    remove_column :sessions, :candidate_id
    add_column :sessions, :candidate_id, :bigint
    add_index :sessions, :candidate_id
  end
end
