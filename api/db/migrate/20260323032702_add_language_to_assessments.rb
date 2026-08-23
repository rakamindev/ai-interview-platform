# frozen_string_literal: true

class AddLanguageToAssessments < ActiveRecord::Migration[8.0]
  def change
    add_column :assessments, :language, :string, default: "en"
  end
end
