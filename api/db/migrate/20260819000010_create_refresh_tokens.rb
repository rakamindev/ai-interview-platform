# frozen_string_literal: true

class CreateRefreshTokens < ActiveRecord::Migration[8.0]
  def change
    create_table :refresh_tokens, id: :uuid do |t|
      t.references :user, type: :integer, null: false, foreign_key: true
      t.string :token_hash, null: false
      t.datetime :expires_at, null: false
      t.datetime :revoked_at
      t.datetime :used_at
      t.datetime :created_at, null: false
      t.datetime :updated_at, null: false

      t.index :token_hash, unique: true
      t.index :expires_at
    end
  end
end
