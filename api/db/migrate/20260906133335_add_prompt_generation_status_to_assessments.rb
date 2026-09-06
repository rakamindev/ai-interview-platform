class AddPromptGenerationStatusToAssessments < ActiveRecord::Migration[7.0]
  def change
    add_column :assessments, :prompt_generation_status, :string, default: 'pending', null: false
    add_column :assessments, :prompt_generation_error, :text
  end
end
