# frozen_string_literal: true

class CreatePortfolioDecisions < ActiveRecord::Migration[7.0]
  def change
    create_table :portfolio_decisions do |t|
      t.references :portfolio, null: false, foreign_key: true, index: { unique: true }
      t.string :ai_outcome, limit: 10
      t.text :ai_rationale
      t.datetime :ai_recommended_at
      t.string :final_outcome, limit: 10
      t.text :finalization_note
      t.bigint :finalized_by_id
      t.datetime :finalized_at
      t.integer :lock_version, null: false, default: 0
      t.timestamps null: false
    end

    create_table :portfolio_decision_events do |t|
      t.references :portfolio_decision, null: false, foreign_key: true
      t.string :event_type, null: false, limit: 30
      t.string :outcome, limit: 10
      t.text :note
      t.bigint :actor_id
      t.datetime :created_at, null: false, default: -> { 'NOW()' }
    end

    add_index :portfolio_decision_events, %i[portfolio_decision_id created_at],
              name: 'idx_portfolio_decision_events_timeline'
    add_check_constraint :portfolio_decisions,
                         "ai_outcome IS NULL OR ai_outcome IN ('pass', 'fail')",
                         name: 'chk_portfolio_decisions_ai_outcome'
    add_check_constraint :portfolio_decisions,
                         "final_outcome IS NULL OR final_outcome IN ('pass', 'fail')",
                         name: 'chk_portfolio_decisions_final_outcome'
    add_check_constraint :portfolio_decisions,
                         <<~SQL.squish,
                           (
                             final_outcome IS NULL
                             AND finalized_by IS NULL
                             AND finalized_at IS NULL
                             AND finalization_note IS NULL
                           )
                           OR
                           (
                             final_outcome IS NOT NULL
                             AND finalized_by IS NOT NULL
                             AND finalized_at IS NOT NULL
                           )
                         SQL
                         name: 'chk_portfolio_decisions_finalization_fields'
    add_check_constraint :portfolio_decision_events,
                         "event_type IN ('ai_recommended', 'admin_finalized', 'admin_reopened')",
                         name: 'chk_portfolio_decision_events_type'
    add_check_constraint :portfolio_decision_events,
                         "outcome IS NULL OR outcome IN ('pass', 'fail')",
                         name: 'chk_portfolio_decision_events_outcome'
  end
end
