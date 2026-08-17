class AddCounterEvidenceToPortfolioSkills < ActiveRecord::Migration[7.0]
  # Evidence-backed evaluation: add a place to store contradicting / missing
  # evidence so the assessor sees both supporting and counter signals.
  # Reversible and safe against existing rows (adds a defaulted JSONB column).
  def up
    add_column :portfolio_skills, :counter_evidence, :jsonb, null: false, default: []
  end

  def down
    remove_column :portfolio_skills, :counter_evidence
  end
end