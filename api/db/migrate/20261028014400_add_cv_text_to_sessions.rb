# frozen_string_literal: true

class AddCvTextToSessions < ActiveRecord::Migration[7.0]
  def change
    add_column :sessions, :cv_text, :text
  end
end
