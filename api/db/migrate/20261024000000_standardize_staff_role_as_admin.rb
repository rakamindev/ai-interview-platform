# frozen_string_literal: true

class StandardizeStaffRoleAsAdmin < ActiveRecord::Migration[7.0]
  def up
    execute <<~SQL
      UPDATE ai_interview.users
      SET role = 'admin'
      WHERE role = 'assessor'
    SQL
  end

  def down
    execute <<~SQL
      UPDATE ai_interview.users
      SET role = 'assessor'
      WHERE role = 'admin'
    SQL
  end
end
