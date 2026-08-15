# frozen_string_literal: true

# Gives the portfolio a way to say "I don't know".
#
# Before this migration `portfolio_skills.ai_level` was NOT NULL, so the schema
# had no representation for a skill that was never probed. Combined with
# `skill_data['level'].to_i.clamp(1, 5)` in Portfolios::Generator, a missing
# level became L1 — the lowest possible rating — on a skill nobody asked the
# candidate about, which FitGap::Engine then reported as a hard gap.
#
# Reversibility notes (read before rolling back):
#   The down path cannot invent ratings. Rows recorded as not_probed or
#   insufficient_evidence carry no level by definition, and the old schema
#   cannot represent them. Restoring NOT NULL therefore requires deleting those
#   rows — the alternative is back-filling the exact fabricated number this
#   migration exists to remove. The delete is scoped to unrated rows only and
#   is announced in the migration output.
class AddAssessmentStateToPortfolioSkills < ActiveRecord::Migration[7.0]
  STATES     = %w[assessed insufficient_evidence not_probed].freeze
  CHECK_NAME = 'chk_portfolio_skills_level_matches_state'
  INDEX_NAME = 'index_portfolio_skills_on_portfolio_id_and_skill_label'

  def up
    create_enum :portfolio_assessment_state, STATES

    add_column :portfolio_skills, :assessment_state, :enum,
               enum_type: 'portfolio_assessment_state',
               default:   'assessed',
               null:      false

    # Every existing row was written under the old always-rate contract, so
    # 'assessed' is the only truthful backfill available for them.
    execute("UPDATE portfolio_skills SET assessment_state = 'assessed'")

    change_column_null :portfolio_skills, :ai_level, true
    # An unassessed skill has no confidence either. Leaving this NOT NULL would
    # force every unrated row to claim "low confidence", which is a statement
    # about a rating that does not exist.
    change_column_null :portfolio_skills, :ai_confidence, true

    # A rating and its state must agree. Without this the application could
    # write assessment_state='not_probed' alongside a level and reintroduce the
    # original defect one layer down.
    add_check_constraint :portfolio_skills,
                         "(assessment_state = 'assessed' AND ai_level IS NOT NULL AND ai_confidence IS NOT NULL) OR " \
                         "(assessment_state <> 'assessed' AND ai_level IS NULL AND ai_confidence IS NULL)",
                         name: CHECK_NAME

    normalise_existing_labels
    deduplicate_existing_skills
    add_index :portfolio_skills, %i[portfolio_id skill_label], unique: true, name: INDEX_NAME

    # Set when the model stops returning a skill that a human has already rated.
    # Such a row is kept rather than deleted: an assessor's judgement outranks a
    # model's decision to omit it.
    add_column :portfolio_skills, :superseded_at, :datetime, null: true
  end

  def down
    unrated = select_value("SELECT COUNT(*) FROM portfolio_skills WHERE ai_level IS NULL").to_i
    if unrated.positive?
      say "Deleting #{unrated} unrated portfolio_skills row(s): the pre-migration schema " \
          'cannot represent a skill without a level, and inventing one is the defect ' \
          'this migration removed.'
      execute('DELETE FROM portfolio_skills WHERE ai_level IS NULL')
    end

    remove_column :portfolio_skills, :superseded_at
    remove_index  :portfolio_skills, name: INDEX_NAME
    remove_check_constraint :portfolio_skills, name: CHECK_NAME
    change_column_null :portfolio_skills, :ai_confidence, false
    change_column_null :portfolio_skills, :ai_level, false
    remove_column :portfolio_skills, :assessment_state
    # drop_enum arrived in Rails 7.1; this app is on 7.0, so drop the type directly.
    execute('DROP TYPE IF EXISTS portfolio_assessment_state')
  end

  private

  # Trailing whitespace is why FitGap::Engine's label match silently missed
  # rows ("React " vs "React"). Normalise before the unique index lands.
  def normalise_existing_labels
    execute('UPDATE portfolio_skills SET skill_label = btrim(skill_label) WHERE skill_label <> btrim(skill_label)')
  end

  # There was never a unique constraint here, so a repeated emission from the
  # model could persist the same skill twice. Keep the row a human has touched;
  # otherwise keep the earliest.
  def deduplicate_existing_skills
    duplicates = select_value(<<~SQL).to_i
      SELECT COUNT(*) FROM (
        SELECT portfolio_id, lower(skill_label)
        FROM portfolio_skills
        GROUP BY portfolio_id, lower(skill_label)
        HAVING COUNT(*) > 1
      ) dupes
    SQL

    return if duplicates.zero?

    say "Deduplicating #{duplicates} portfolio/skill group(s); rows carrying an assessor override are preserved."

    execute(<<~SQL)
      WITH ranked AS (
        SELECT ps.id,
               ROW_NUMBER() OVER (
                 PARTITION BY ps.portfolio_id, lower(ps.skill_label)
                 ORDER BY (o.id IS NOT NULL) DESC, ps.id ASC
               ) AS rn
        FROM portfolio_skills ps
        LEFT JOIN assessor_overrides o ON o.portfolio_skill_id = ps.id
      )
      DELETE FROM portfolio_skills WHERE id IN (SELECT id FROM ranked WHERE rn > 1)
    SQL
  end
end
