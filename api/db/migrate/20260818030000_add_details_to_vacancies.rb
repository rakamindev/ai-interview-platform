# frozen_string_literal: true

class AddDetailsToVacancies < ActiveRecord::Migration[7.0]
  def change
    add_column :vacancies, :address, :text
    add_column :vacancies, :city, :string, limit: 120
    add_column :vacancies, :work_arrangement, :string, limit: 20
    add_column :vacancies, :employment_type, :string, limit: 20
    add_column :vacancies, :department, :string, limit: 120
    add_column :vacancies, :salary_min, :integer
    add_column :vacancies, :salary_max, :integer
    add_column :vacancies, :salary_visible, :boolean, null: false, default: false
    add_column :vacancies, :description, :text
    add_column :vacancies, :application_deadline, :date
  end
end
