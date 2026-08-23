# frozen_string_literal: true

class AddUpdatedByToAssessments < ActiveRecord::Migration[7.0]
  def change
    add_column :assessments, :updated_by, :bigint
  end
end
