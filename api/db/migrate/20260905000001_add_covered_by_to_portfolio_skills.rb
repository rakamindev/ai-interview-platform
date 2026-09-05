# frozen_string_literal: true

# Denormalised from coverage_maps so the portfolio records the provenance the
# rating was derived from, not whatever coverage_maps holds at render time.
class AddCoveredByToPortfolioSkills < ActiveRecord::Migration[7.0]
  def up
    add_column :portfolio_skills, :covered_by, 'ai_interview.coverage_promotion_source'
  end

  def down
    remove_column :portfolio_skills, :covered_by
  end
end
