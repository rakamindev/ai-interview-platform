# frozen_string_literal: true

class AddJobRequirementsToVacancies < ActiveRecord::Migration[7.0]
  def change
    add_column :vacancies, :location, :string, limit: 255
    add_column :vacancies, :work_arrangement, :string, limit: 20
    add_column :vacancies, :employment_type, :string, limit: 20
    add_column :vacancies, :minimum_education, :string, limit: 100
    add_column :vacancies, :salary_min, :integer
    add_column :vacancies, :salary_max, :integer
    add_column :vacancies, :experience_level, :string, limit: 20
    add_column :vacancies, :experience_years_min, :integer
    add_column :vacancies, :experience_years_max, :integer

    add_check_constraint :vacancies,
                         "work_arrangement IS NULL OR work_arrangement IN ('onsite', 'hybrid', 'remote')",
                         name: "chk_vacancies_work_arrangement"
    add_check_constraint :vacancies,
                         "employment_type IS NULL OR employment_type IN ('full_time', 'contract', 'internship')",
                         name: "chk_vacancies_employment_type"
    add_check_constraint :vacancies,
                         "salary_min IS NULL OR salary_max IS NULL OR salary_min <= salary_max",
                         name: "chk_vacancies_salary_range"
    add_check_constraint :vacancies,
                         "experience_level IS NULL OR experience_level IN ('intern', 'associate', 'mid', 'senior', 'lead')",
                         name: "chk_vacancies_experience_level"
    add_check_constraint :vacancies,
                         "experience_years_min IS NULL OR experience_years_max IS NULL OR experience_years_min <= experience_years_max",
                         name: "chk_vacancies_experience_years_range"
  end
end
