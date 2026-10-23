# frozen_string_literal: true

# Records which comparison rules produced a stored report.
#
# Nullable with no default: existing rows stay NULL, which marks them as
# produced by the legacy rules (low-confidence ratings shown as gaps). They are
# recomputed on next request instead of being shown or exported. Adding a
# nullable column without a default is a metadata-only change in PostgreSQL,
# so it does not rewrite or lock the table for long.
class AddComparatorVersionToFitGapReports < ActiveRecord::Migration[7.0]
  def change
    add_column :fit_gap_reports, :comparator_version, :integer
  end
end
