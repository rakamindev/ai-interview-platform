# frozen_string_literal: true

# Lets the API tell how long a portfolio has been in its current status, so a
# job that was lost (queue outage, killed worker) can be detected as stale.
class AddStatusChangedAtToPortfolios < ActiveRecord::Migration[7.0]
  def up
    add_column :portfolios, :status_changed_at, :datetime, precision: 6

    # Backfill existing rows with the best known timestamp.
    execute <<~SQL
      UPDATE portfolios
      SET status_changed_at = COALESCE(
        generated_at,
        (SELECT ended_at FROM sessions WHERE sessions.id = portfolios.session_id),
        NOW()
      )
      WHERE status_changed_at IS NULL
    SQL
  end

  def down
    remove_column :portfolios, :status_changed_at
  end
end
