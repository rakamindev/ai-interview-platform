# frozen_string_literal: true

# Adds organization_id foreign key to users in the ai_interview schema.
class AddOrganizationIdToUsers < ActiveRecord::Migration[7.0]
  def change
    execute 'SET search_path TO ai_interview, public'

    add_reference :users, :organization, null: true, foreign_key: { to_table: :organizations }
  end
end
