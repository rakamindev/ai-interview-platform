# frozen_string_literal: true

# A configured skill that Gemini never mentioned, or mentioned but returned
# in a shape we can't parse a level from, was previously either silently
# absent from portfolio_skills or clamped to ai_level=1 (the lowest possible
# score) — indistinguishable from a candidate who was actually assessed and
# scored poorly. See assessment/gap-analysis.md P0-4.
#
# Adds an explicit status so "never assessed" and "AI response unparseable"
# are their own states instead of hiding inside a fabricated score.
# ai_level/ai_confidence become nullable since those two states have no
# level to report.
class AddStatusToPortfolioSkills < ActiveRecord::Migration[7.0]
  def up
    # No schema prefix — matches how every other enum in this codebase is
    # created (they rely on `schema_search_path` to resolve the namespace,
    # e.g. `generation_status`, `confidence_level`), so this works whether
    # the `ai_interview` schema exists (dev/prod) or not (a plain
    # `db:schema:load` in test never creates that namespace, tables just
    # land in `public`).
    execute <<~SQL.squish
      CREATE TYPE portfolio_skill_status AS ENUM ('assessed', 'not_assessed', 'unparseable')
    SQL

    add_column :portfolio_skills, :status, 'portfolio_skill_status', null: false, default: 'assessed'

    change_column_null :portfolio_skills, :ai_level, true
    change_column_null :portfolio_skills, :ai_confidence, true
  end

  # Deliberately does not restore the ai_level/ai_confidence NOT NULL
  # constraints: rows created as not_assessed/unparseable after this
  # migration legitimately have NULL there, and re-adding NOT NULL would
  # fail (or silently corrupt data) once any such row exists. Nullable is a
  # safe superset of NOT NULL, so leaving it relaxed keeps `down` safe to
  # run at any point instead of only immediately after `up`.
  def down
    remove_column :portfolio_skills, :status
    execute "DROP TYPE portfolio_skill_status"
  end
end
