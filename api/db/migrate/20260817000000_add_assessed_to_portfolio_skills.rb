# frozen_string_literal: true

# ai_level, ai_confidence and competency_summary were NOT NULL, so a skill the
# interview never probed could only be stored by inventing values for it. Adds an
# `assessed` flag and relaxes the three columns.
#
# Existing rows default to assessed = true. Past portfolios are not re-labelled:
# what an assessor already saw and acted on stays as it was.
class AddAssessedToPortfolioSkills < ActiveRecord::Migration[7.0]
  def up
    add_column :portfolio_skills, :assessed, :boolean, default: true, null: false

    change_column_null :portfolio_skills, :ai_level,           true
    change_column_null :portfolio_skills, :ai_confidence,      true
    change_column_null :portfolio_skills, :competency_summary, true

    # An assessed skill must still carry a full rating; an unassessed one must not.
    add_check_constraint :portfolio_skills,
                         'NOT assessed OR (ai_level IS NOT NULL AND ai_confidence IS NOT NULL)',
                         name: 'chk_portfolio_skills_assessed_has_rating'
  end

  def down
    remove_check_constraint :portfolio_skills, name: 'chk_portfolio_skills_assessed_has_rating'

    # Rows added while the flag existed may hold NULLs the old schema forbids.
    # Give them the lowest defensible values so NOT NULL can be restored without
    # dropping data.
    #
    # Lossy on the way back: migrate up again and these read as assessed L1/low,
    # the invented ratings this migration exists to prevent. The summary string
    # below is the marker to find them by and undo it.
    execute <<~SQL
      UPDATE portfolio_skills
      SET ai_level           = COALESCE(ai_level, 1),
          ai_confidence      = COALESCE(ai_confidence, 'low'),
          competency_summary = COALESCE(competency_summary, 'Not assessed in this interview.')
      WHERE ai_level IS NULL
         OR ai_confidence IS NULL
         OR competency_summary IS NULL
    SQL

    change_column_null :portfolio_skills, :ai_level,           false
    change_column_null :portfolio_skills, :ai_confidence,      false
    change_column_null :portfolio_skills, :competency_summary, false

    remove_column :portfolio_skills, :assessed
  end
end
