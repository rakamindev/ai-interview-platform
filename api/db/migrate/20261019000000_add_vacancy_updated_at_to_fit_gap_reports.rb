# frozen_string_literal: true

class AddVacancyUpdatedAtToFitGapReports < ActiveRecord::Migration[7.0]
  def change
    add_column :fit_gap_reports, :vacancy_updated_at, :datetime
  end
end
