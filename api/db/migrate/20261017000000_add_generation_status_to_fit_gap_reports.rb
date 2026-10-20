# frozen_string_literal: true

# Lets a fit/gap report row be claimed before it's generated (P1-6). The first request inserts a "generating" row;
# the unique index on (portfolio_id, vacancy_id) makes that insert the lock, so a second request finds the claim
# and queues nothing. requested_at lets a claim whose job died be taken over.
#
# Existing rows become "complete", which is what they are. Rollback deletes only claims that never finished
# (they hold no report), then drops the columns.
class AddGenerationStatusToFitGapReports < ActiveRecord::Migration[7.0]
  def up
    add_column :fit_gap_reports, :generation_status, :string, limit: 20, null: false, default: 'complete'
    add_column :fit_gap_reports, :requested_at, :datetime
    add_check_constraint :fit_gap_reports, "generation_status IN ('generating', 'complete')",
                         name: 'chk_fit_gap_reports_generation_status'
  end

  def down
    execute "DELETE FROM fit_gap_reports WHERE generation_status = 'generating'"
    remove_check_constraint :fit_gap_reports, name: 'chk_fit_gap_reports_generation_status'
    remove_column :fit_gap_reports, :requested_at
    remove_column :fit_gap_reports, :generation_status
  end
end
