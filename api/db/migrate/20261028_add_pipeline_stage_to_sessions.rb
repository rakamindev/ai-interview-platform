# frozen_string_literal: true

class AddPipelineStageToSessions < ActiveRecord::Migration[7.0]
  def change
    add_column :sessions, :pipeline_stage, :string, limit: 20, null: true, default: nil
    add_check_constraint :sessions,
      "pipeline_stage IS NULL OR pipeline_stage IN ('shortlisted', 'hired', 'rejected')",
      name: "chk_sessions_pipeline_stage"
    add_index :sessions, :pipeline_stage, name: "idx_sessions_pipeline_stage"
  end
end

