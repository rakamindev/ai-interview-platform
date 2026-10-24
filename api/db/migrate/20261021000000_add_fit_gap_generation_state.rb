# frozen_string_literal: true

class AddFitGapGenerationState < ActiveRecord::Migration[7.0]
  def change
    add_column :fit_gap_reports, :source_digest, :string, limit: 64

    create_table :fit_gap_generation_requests do |t|
      t.references :portfolio, null: false, foreign_key: true
      t.references :vacancy, null: false, foreign_key: true
      t.string :status, null: false, default: 'queued', limit: 20
      t.string :request_token, null: false, limit: 64
      t.string :source_digest, null: false, limit: 64
      t.string :error_code, limit: 100
      t.timestamps null: false
    end

    add_index :fit_gap_generation_requests, %i[portfolio_id vacancy_id],
              unique: true, name: 'idx_fit_gap_generation_pair'
  end
end
