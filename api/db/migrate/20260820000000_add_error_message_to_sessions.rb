# frozen_string_literal: true

class AddErrorMessageToSessions < ActiveRecord::Migration[7.0]
  def change
    add_column :sessions, :error_message, :text
  end
end
