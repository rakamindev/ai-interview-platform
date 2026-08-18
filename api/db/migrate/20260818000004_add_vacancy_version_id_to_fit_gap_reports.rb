# frozen_string_literal: true

class AddVacancyVersionIdToFitGapReports < ActiveRecord::Migration[7.0]
  def change
    add_column :fit_gap_reports, :vacancy_version_id, :bigint
  end
end
