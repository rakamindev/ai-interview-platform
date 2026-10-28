# frozen_string_literal: true

class AddEmploymentAndWorkplaceToVacancies < ActiveRecord::Migration[7.0]
  def change
    add_column :vacancies, :employment_type, :string, default: "full_time"
    add_column :vacancies, :workplace_type, :string, default: "on_site"
  end
end

