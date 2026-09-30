# frozen_string_literal: true

class CreateAiInterviewUsers < ActiveRecord::Migration[7.0]
  def change
    create_table :users do |t|
      t.string  :email,           null: false, limit: 255
      t.string  :password_digest, null: false
      t.string  :role,            null: false, default: 'user', limit: 20
      t.references :organization, type: :uuid, foreign_key: true, null: true
      t.timestamps null: false
    end

    add_index :users, :email, unique: true, name: 'idx_ai_interview_users_email'
  end
end
