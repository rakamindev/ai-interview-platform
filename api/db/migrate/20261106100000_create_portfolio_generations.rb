# frozen_string_literal: true

# Gives every portfolio scoring run its own identity, so a late or duplicate job can be told apart
# from the run that is currently published. Purely additive: no existing column changes meaning,
# and existing rows are linked up by the following backfill migration.
class CreatePortfolioGenerations < ActiveRecord::Migration[7.0]
  def change
    create_table :portfolio_generations do |t|
      t.references :portfolio, null: false, foreign_key: true
      t.integer  :sequence, null: false
      t.string   :status, null: false, default: 'queued'
      # Incremented on every claim. A worker may change the run's status only while the counter still
      # equals the value it claimed with, so a worker that lost its claim cannot interfere.
      t.integer  :claim_count, null: false, default: 0
      t.string   :source, null: false
      t.string   :requested_model
      t.string   :served_model
      t.string   :provider_response_id
      t.string   :prompt_version
      # Non-secret fingerprint of the scoring configuration (model, endpoint, a hash of the key).
      # Lets a failure that needs an administrator unblock once the configuration actually changes.
      t.string   :config_fingerprint
      t.string   :error_code
      t.text     :error_message
      t.jsonb    :validation, null: false, default: {}
      t.datetime :queued_at, null: false, default: -> { 'now()' }
      t.datetime :started_at
      t.datetime :finished_at
    end

    add_index :portfolio_generations, %i[portfolio_id sequence], unique: true
    add_check_constraint :portfolio_generations,
                         "status IN ('queued', 'running', 'retrying', 'succeeded', 'failed', 'superseded')",
                         name: 'chk_portfolio_generations_status'

    add_reference :portfolios, :current_generation,
                  foreign_key: { to_table: :portfolio_generations }, null: true

    add_reference :portfolio_skills, :generation,
                  foreign_key: { to_table: :portfolio_generations }, null: true
    add_column :portfolio_skills, :skill_key, :string
    add_index  :portfolio_skills, %i[generation_id skill_key], unique: true
  end
end
