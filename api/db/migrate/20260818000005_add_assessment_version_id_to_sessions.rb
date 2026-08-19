# frozen_string_literal: true

class AddAssessmentVersionIdToSessions < ActiveRecord::Migration[7.0]
  def change
    add_column :sessions, :assessment_version_id, :bigint
  end
end
