# frozen_string_literal: true

# Lets Portfolios::Generator tell an actively-running job apart from one whose
# worker crashed mid-run (status stuck at 'generating'), so duplicate jobs are
# skipped without ever leaving a portfolio permanently locked.
class AddGenerationStartedAtToPortfolios < ActiveRecord::Migration[7.0]
  def change
    add_column :portfolios, :generation_started_at, :datetime
  end
end
