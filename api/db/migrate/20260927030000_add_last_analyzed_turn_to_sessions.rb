class AddLastAnalyzedTurnToSessions < ActiveRecord::Migration[7.0]
  def change
    add_column :sessions, :last_analyzed_turn, :integer
  end
end
