class AddPortfolioGenerationState < ActiveRecord::Migration[7.0]
  def up
    add_column :portfolios, :generation_started_at, :datetime, precision: 6
    add_column :portfolios, :generation_token, :string, limit: 64
  end

  def down
    remove_column :portfolios, :generation_token
    remove_column :portfolios, :generation_started_at
  end
end
