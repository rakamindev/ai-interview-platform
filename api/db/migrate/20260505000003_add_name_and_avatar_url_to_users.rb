# frozen_string_literal: true

class AddNameAndAvatarUrlToUsers < ActiveRecord::Migration[7.0]
  def change
    execute "SET search_path TO ai_interview, public"
    add_column :users, :name, :string, limit: 255
    add_column :users, :avatar_url, :text
  end
end
