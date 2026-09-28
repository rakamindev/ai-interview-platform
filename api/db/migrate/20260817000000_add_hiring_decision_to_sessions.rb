# frozen_string_literal: true

class AddHiringDecisionToSessions < ActiveRecord::Migration[7.0]
  def change
    add_column :sessions, :hiring_decision, :string, limit: 20
    add_column :sessions, :decision_notes, :text
    add_column :sessions, :decided_by, :bigint
    add_column :sessions, :decided_at, :datetime

    add_index :sessions, :hiring_decision
    add_index :sessions, :decided_by

    add_check_constraint :sessions,
                         "hiring_decision IS NULL OR hiring_decision IN ('advance', 'hold', 'reject')",
                         name: 'chk_sessions_hiring_decision'
  end
end
