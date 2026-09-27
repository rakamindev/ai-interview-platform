
# frozen_string_literal: true

class AddHiringDecisionToSessions < ActiveRecord::Migration[7.0]
  def change
    add_column :sessions,
               :hiring_decision,
               :string,
               default: "under_review",
               null: false

    add_column :sessions,
               :decision_notes,
               :text

    add_column :sessions,
               :decided_at,
               :datetime

    add_index :sessions, :hiring_decision
  end
end
