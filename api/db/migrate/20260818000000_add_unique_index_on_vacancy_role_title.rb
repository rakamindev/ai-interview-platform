# frozen_string_literal: true

class AddUniqueIndexOnVacancyRoleTitle < ActiveRecord::Migration[7.0]
  def up
    execute <<-SQL.squish
      CREATE UNIQUE INDEX index_vacancies_on_tenant_id_normalized_role_title
      ON vacancies (tenant_id, LOWER(TRIM(role_title)))
    SQL
  end

  def down
    remove_index :vacancies, name: "index_vacancies_on_tenant_id_normalized_role_title"
  end
end
