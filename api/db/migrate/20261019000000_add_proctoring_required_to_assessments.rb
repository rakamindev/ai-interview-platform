# frozen_string_literal: true

# Whether an assessment's interviews require the camera and a full-screen share to stay on (monitored, not recorded).
# Off for every existing assessment, so their interviews run exactly as before.
class AddProctoringRequiredToAssessments < ActiveRecord::Migration[8.1]
  def change
    add_column :assessments, :proctoring_required, :boolean, null: false, default: false
  end
end
