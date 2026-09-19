# frozen_string_literal: true

class AddProvenanceTokenToFitGapReports < ActiveRecord::Migration[7.0]
  def up
    execute "SET search_path TO ai_interview, public"

    add_column :fit_gap_reports, :provenance_token, :string
  end

  def down
    remove_column :fit_gap_reports, :provenance_token
  end
end