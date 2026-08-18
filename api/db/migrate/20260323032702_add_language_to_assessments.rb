class AddLanguageToAssessments < ActiveRecord::Migration[7.0]
  def change
    add_column :assessments, :language, :string, default: 'en'
  end
end
