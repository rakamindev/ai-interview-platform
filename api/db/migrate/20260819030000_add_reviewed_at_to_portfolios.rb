class AddReviewedAtToPortfolios < ActiveRecord::Migration[7.0]
  def change
    add_column :portfolios, :reviewed_at, :datetime
  end
end