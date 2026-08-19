class BackfillPortfolioVerdictSummaries < ActiveRecord::Migration[7.0]
  def up
    Portfolio.where(generation_status: "complete", verdict_summary: nil).find_each(&:recompute_verdict!)
  end

  def down
    # Irreversible: no record of which summaries were backfilled vs. genuinely nil.
  end
end
