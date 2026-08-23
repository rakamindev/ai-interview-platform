class AssessmentRemoveName < ActiveRecord::Migration[7.0]
  def change
    remove_column :assessments, :name
  end
end
