# frozen_string_literal: true

class CreateMemberships < ActiveRecord::Migration[8.0]
  def change
    create_table :memberships, id: :uuid do |t|
      t.references :user, null: false, foreign_key: true, type: :bigint
      t.references :organization, null: false, foreign_key: true, type: :bigint
      t.string :role, null: false, default: "user"
      t.timestamps
      t.index [:user_id, :organization_id], unique: true
    end
  end
end
