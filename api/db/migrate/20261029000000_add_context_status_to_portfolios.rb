# frozen_string_literal: true

class AddContextStatusToPortfolios < ActiveRecord::Migration[7.0]
  def change
    add_column :portfolios, :context_status, :string, limit: 30, default: 'relevant', null: false
    add_column :portfolios, :context_notes, :text
    add_index :portfolios, :context_status, name: 'idx_portfolios_context_status'
  end
end
