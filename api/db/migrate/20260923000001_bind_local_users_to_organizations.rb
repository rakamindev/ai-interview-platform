# frozen_string_literal: true

class BindLocalUsersToOrganizations < ActiveRecord::Migration[7.0]
  def change
    # Existing multi-organization installations require an explicit administrator
    # mapping. Never infer membership from a client-supplied header.
    add_reference :users, :organization, foreign_key: true, null: true
  end
end
