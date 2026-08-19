# frozen_string_literal: true

class CreateConsents < ActiveRecord::Migration[7.0]
  def change
    create_table :consents do |t|
      t.references :session, null: false, foreign_key: true, index: { unique: true }
      t.boolean :given, null: false, default: false
      t.datetime :given_at
      t.string :policy_version, null: false
      t.string :ip_address

      t.timestamps
    end
  end
end
