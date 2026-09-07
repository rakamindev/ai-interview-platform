# frozen_string_literal: true

# Adds the two columns N10 needs to run its failure paths explicitly:
#
#   generation_started_at — when the current attempt claimed the row. A `generating`
#                           row older than Portfolio::STALE_GENERATION_AFTER is a
#                           crashed worker, not a live one, so it can be reclaimed.
#                           This is what unsticks the portfolios found stuck on
#                           "generating" in Step 3.
#   generation_attempts   — how many times we have tried, for observability and for
#                           the failure message on the assessor's screen.
#
# Safety on existing rows:
#   * both columns are additive — no existing column is changed or dropped;
#   * `generation_started_at` is nullable, so existing rows keep working and an old
#     `generating` row reads as stale (started_at nil) and becomes reclaimable —
#     exactly the behaviour we want;
#   * `generation_attempts` is NOT NULL with a default, which PostgreSQL 11+ applies
#     as catalog metadata rather than rewriting the table, so this is safe on a large
#     table and does not lock it for long;
#   * `change` with `add_column` is automatically reversible — `rails db:rollback`
#     drops both columns and nothing else.
class AddGenerationTrackingToPortfolios < ActiveRecord::Migration[7.0]
  def change
    add_column :portfolios, :generation_started_at, :datetime
    add_column :portfolios, :generation_attempts, :integer, default: 0, null: false

    # Lets the "is anything stuck?" query hit an index instead of scanning.
    add_index :portfolios, %i[generation_status generation_started_at],
              name: 'index_portfolios_on_generation_progress'
  end
end
