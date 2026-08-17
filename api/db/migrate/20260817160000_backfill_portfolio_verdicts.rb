class BackfillPortfolioVerdicts < ActiveRecord::Migration[7.0]
  def up
    Portfolio.where(generation_status: "complete", verdict: nil).find_each(&:recompute_verdict!)
  end

  def down
    # Irreversible: no record of which verdicts were backfilled vs. genuinely nil.
  end
end
