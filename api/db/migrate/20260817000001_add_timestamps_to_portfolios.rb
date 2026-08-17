# frozen_string_literal: true

class AddTimestampsToPortfolios < ActiveRecord::Migration[7.0]
  def change
    add_timestamps :portfolios, default: -> { 'CURRENT_TIMESTAMP' }, null: false
  end
end