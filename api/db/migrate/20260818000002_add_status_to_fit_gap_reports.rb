# frozen_string_literal: true

# REL-3: give fit/gap generation a terminal state so the client can stop polling
# and surface failures instead of a perpetual "generating".
class AddStatusToFitGapReports < ActiveRecord::Migration[7.0]
  def up
    execute 'SET search_path TO ai_interview, public'
    # Existing rows only exist because generation succeeded → 'complete'.
    add_column :fit_gap_reports, :generation_status, :string, null: false, default: 'complete'
    add_column :fit_gap_reports, :generation_error, :text
  end

  def down
    execute 'SET search_path TO ai_interview, public'
    remove_column :fit_gap_reports, :generation_error
    remove_column :fit_gap_reports, :generation_status
  end
end
