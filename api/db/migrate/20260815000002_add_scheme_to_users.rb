# frozen_string_literal: true

# Binds each user to exactly one tenant (organization scheme).
#
# Intentionally has NO default value: a hardcoded default tenant would silently
# attach new users to an arbitrary organization. Tenant membership must always be
# assigned explicitly. Login fails closed for users without a valid scheme.
class AddSchemeToUsers < ActiveRecord::Migration[7.0]
  def up
    add_column :users, :scheme, :string unless column_exists?(:users, :scheme)
    add_index :users, :scheme unless index_exists?(:users, :scheme)
  end

  def down
    remove_column :users, :scheme if column_exists?(:users, :scheme)
  end
end
