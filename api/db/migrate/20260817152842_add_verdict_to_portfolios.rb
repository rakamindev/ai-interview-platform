class AddVerdictToPortfolios < ActiveRecord::Migration[7.0]
  def change
    add_column :portfolios, :verdict, :string
    add_index :portfolios, :verdict
  end
end
