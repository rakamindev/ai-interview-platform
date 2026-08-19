# frozen_string_literal: true

class AddForeignKeysToVersionColumns < ActiveRecord::Migration[7.0]
  def change
    add_index :fit_gap_reports, :vacancy_version_id
    add_foreign_key :fit_gap_reports, :vacancy_versions

    add_index :sessions, :assessment_version_id
    add_foreign_key :sessions, :assessment_versions
  end
end
