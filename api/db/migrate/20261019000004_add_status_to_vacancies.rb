# frozen_string_literal: true

class AddStatusToVacancies < ActiveRecord::Migration[7.0]
  def change
    add_column :vacancies, :status, :string, null: false, default: 'active'
    add_check_constraint :vacancies, "status IN ('active', 'draft', 'closed')", name: 'chk_vacancies_status'
  end
end
