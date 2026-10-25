# frozen_string_literal: true

class RenameUserRoles < ActiveRecord::Migration[7.0]
  def up
    # Update existing 'user' rows to 'recruiter'
    execute "UPDATE users SET role = 'recruiter' WHERE role = 'user'"

    # Change column default for new records
    change_column_default :users, :role, 'recruiter'
  end

  def down
    # Revert default
    change_column_default :users, :role, 'user'

    # Revert data
    execute "UPDATE users SET role = 'user' WHERE role = 'recruiter'"
  end
end
