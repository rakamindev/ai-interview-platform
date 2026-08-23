# frozen_string_literal: true

# The model (PortfolioSkill) and Portfolios::ResponseValidator both treat a
# missing/unrecognized Gemini confidence value as nil by design (never
# silently coerced to a level) — validated with `allow_nil: true` — but the
# original migration set this column NOT NULL, so any skill with an
# unrecognized confidence value crashes the write instead of persisting with
# nil confidence.
class AllowNullAiConfidenceOnPortfolioSkills < ActiveRecord::Migration[8.0]
  def up
    change_column_null :portfolio_skills, :ai_confidence, true
  end

  def down
    change_column_null :portfolio_skills, :ai_confidence, false
  end
end
