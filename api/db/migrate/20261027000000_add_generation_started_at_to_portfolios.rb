# frozen_string_literal: true

class AddGenerationStartedAtToPortfolios < ActiveRecord::Migration[7.0]
  def up
    # Nullable on purpose: rows that are not generating keep NULL.
    add_column :portfolios, :generation_started_at, :datetime

    # Rows already stuck on 'generating' when this ships start their stale
    # clock now, so they time out instead of spinning forever. Without the
    # backfill a NULL started_at could never be reconciled, because the
    # table has no updated_at column either.
    execute "UPDATE portfolios SET generation_started_at = NOW() WHERE generation_status = 'generating'"
  end

  def down
    remove_column :portfolios, :generation_started_at
  end
end
