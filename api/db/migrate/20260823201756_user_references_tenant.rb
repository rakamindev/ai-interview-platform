class UserReferencesTenant < ActiveRecord::Migration[7.0]
  def change
    add_reference :users, :organization, foreign_key: true, null: true

    User.update_all(organization_id: Organization.first.id)

    change_column_null :users, :organization_id, false
  end
end
