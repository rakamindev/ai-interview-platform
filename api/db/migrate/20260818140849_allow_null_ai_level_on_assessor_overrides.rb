class AllowNullAiLevelOnAssessorOverrides < ActiveRecord::Migration[7.0]
  def change
    change_column_null :assessor_overrides, :ai_level, true
  end
end
