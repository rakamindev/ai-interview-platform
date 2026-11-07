# frozen_string_literal: true

# When the current generation attempt was requested, to tell a slow portfolio from a stuck one.
# Nullable: existing rows fall back to the end of their session.
class AddGenerationRequestedAtToPortfolios < ActiveRecord::Migration[7.0]
  def change
    add_column :portfolios, :generation_requested_at, :datetime
  end
end
