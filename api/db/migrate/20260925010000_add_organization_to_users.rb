# frozen_string_literal: true

class AddOrganizationToUsers < ActiveRecord::Migration[7.0]
  def up
    add_reference :users, :organization, null: true, index: true

    # Compatibility only when tenancy is unambiguous. In a multi-organization
    # database we deliberately do not guess a user's organization.
    organization_ids = select_values('SELECT id FROM organizations ORDER BY id ASC LIMIT 2')
    if organization_ids.one?
      execute <<~SQL.squish
        UPDATE users
        SET organization_id = #{connection.quote(organization_ids.first)}
        WHERE organization_id IS NULL
      SQL
    end
  end

  def down
    remove_reference :users, :organization
  end
end
