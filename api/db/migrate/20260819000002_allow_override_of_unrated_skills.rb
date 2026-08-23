# frozen_string_literal: true

# assessor_overrides.ai_level records what the model said at the moment an
# assessor disagreed with it. Once portfolio_skills.ai_level became nullable
# (20260819000000), that record has a legitimate empty value: the model said
# nothing, because the interview never produced evidence for this skill.
#
# Leaving the column NOT NULL would make the most valuable correction in the
# product impossible — an assessor who knows the candidate's level for a skill
# the interview missed could not enter it, because the schema demanded an AI
# level that does not exist. The override endpoint would return 422 on exactly
# the skills that most need a human.
#
# As in the earlier migration, the existing CHECK (ai_level BETWEEN 1 AND 5)
# admits NULL unchanged and still rejects out-of-range integers.
class AllowOverrideOfUnratedSkills < ActiveRecord::Migration[7.0]
  def up
    change_column_null :assessor_overrides, :ai_level, true
  end

  def down
    orphaned = select_value(
      'SELECT COUNT(*) FROM ai_interview.assessor_overrides WHERE ai_level IS NULL'
    ).to_i

    if orphaned.positive?
      raise ActiveRecord::IrreversibleMigration, <<~MSG
        #{orphaned} assessor_overrides row(s) have ai_level IS NULL — assessor
        judgements on skills the model never rated. The previous schema cannot
        express them, and any value chosen here would fabricate a model rating
        that was never produced.

        Decide explicitly before rolling back, e.g.:

          DELETE FROM ai_interview.assessor_overrides WHERE ai_level IS NULL;
      MSG
    end

    change_column_null :assessor_overrides, :ai_level, false
  end
end
