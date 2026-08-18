# frozen_string_literal: true

# Records that a human has finished reviewing a candidate's results.
#
# Without this the candidate list can show a review queue but never clear it:
# every finished interview stays "ready to review" forever, so after fifty
# candidates that count means nothing more than "everyone who finished".
#
# Reversible and safe against existing rows: two nullable columns on an
# existing table, no backfill, no default. Every session already in the
# database reads as not yet reviewed, which is true.
class AddReviewStateToSessions < ActiveRecord::Migration[7.0]
  def change
    add_column :sessions, :reviewed_at, :datetime, precision: 6
    add_column :sessions, :reviewed_by, :bigint

    # The list filters on "not reviewed yet", so the partial index covers the
    # rows actually scanned rather than the whole table.
    add_index :sessions, %i[tenant_id reviewed_at],
              name: 'idx_sessions_tenant_reviewed_at'
  end
end
