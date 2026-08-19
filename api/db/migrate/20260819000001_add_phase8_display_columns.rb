# frozen_string_literal: true

# Backend support for Phase 8's UI requirements:
#   - cv_screening_entries.score — Layer 2's 0-100 score, never persisted before
#     now (Phase 6 discarded it once used). Needed to show a score badge on
#     sessions that originated from CV screening.
#   - vacancy_versions/assessment_versions.approximate — distinguishes a version
#     row created by Phase 2's backfill task (built from a record's CURRENT state,
#     not its actual history) from one created by a real save. Needed for the
#     "approximate, not historical" badge the plan doc calls for.
class AddPhase8DisplayColumns < ActiveRecord::Migration[7.0]
  def change
    add_column :cv_screening_entries, :score, :integer
    add_column :vacancy_versions, :approximate, :boolean, null: false, default: false
    add_column :assessment_versions, :approximate, :boolean, null: false, default: false
  end
end
