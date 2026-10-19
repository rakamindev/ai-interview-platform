# frozen_string_literal: true

class RestrictVacancyStatuses < ActiveRecord::Migration[7.0]
  def up
    if select_value("SELECT 1 FROM vacancies WHERE status = 'draft' LIMIT 1")
      raise 'Cannot remove draft status while draft vacancies exist'
    end

    remove_check_constraint :vacancies, name: 'chk_vacancies_status'
    add_check_constraint :vacancies, "status IN ('active', 'closed')", name: 'chk_vacancies_status'
  end

  def down
    remove_check_constraint :vacancies, name: 'chk_vacancies_status'
    add_check_constraint :vacancies, "status IN ('active', 'draft', 'closed')", name: 'chk_vacancies_status'
  end
end
