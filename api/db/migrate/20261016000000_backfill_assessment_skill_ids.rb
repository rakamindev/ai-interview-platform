# frozen_string_literal: true

# Backfills assessment_skills.skill_id for non-custom rows whose label
# matches a taxonomy entry (rows created before the picker stored ids).
# down applies the same predicate in reverse; it cannot distinguish rows
# backfilled here from ids written later by the app, so only roll back
# before the picker fix ships.
class BackfillAssessmentSkillIds < ActiveRecord::Migration[7.0]
  def up
    execute 'SET search_path TO ai_interview, public'

    execute <<~SQL
      UPDATE assessment_skills
      SET skill_id = tax.skill_id
      FROM skill_taxonomies AS tax
      WHERE assessment_skills.skill_id IS NULL
        AND assessment_skills.is_custom = FALSE
        AND LOWER(assessment_skills.skill_label) = LOWER(tax.skill_label)
    SQL
  end

  def down
    execute 'SET search_path TO ai_interview, public'

    execute <<~SQL
      UPDATE assessment_skills
      SET skill_id = NULL
      FROM skill_taxonomies AS tax
      WHERE assessment_skills.is_custom = FALSE
        AND LOWER(assessment_skills.skill_label) = LOWER(tax.skill_label)
    SQL
  end
end
