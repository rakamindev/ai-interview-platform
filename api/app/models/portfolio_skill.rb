# frozen_string_literal: true

class PortfolioSkill < ApplicationRecord
  CONFIDENCE_LEVELS = %w[high medium low].freeze
  ASSESSMENT_STATUSES = %w[assessed insufficient_evidence not_assessed].freeze

  belongs_to :portfolio
  has_one :assessor_override, dependent: :destroy

  validates :skill_label, presence: true
  validates :assessment_status, inclusion: { in: ASSESSMENT_STATUSES }
  # not_assessed carries no level by design (see db/migrate/
  # 20261024063750_add_assessment_status_to_portfolio_skills.rb) — the DB
  # CHECK constraint is the real enforcement; this validation exists so a
  # mismatch surfaces as a normal ActiveRecord::RecordInvalid instead of a
  # raw PG::CheckViolation.
  validates :ai_level, numericality: { only_integer: true, in: 1..5 }, allow_nil: true
  validate :level_presence_matches_status
  validates :ai_confidence, inclusion: { in: CONFIDENCE_LEVELS }
  validates :competency_summary, presence: true

  # evidence is stored as JSONB array of quote strings
  def evidence_quotes
    Array(evidence)
  end

  private

  # Not a strict biconditional — see the matching DB CHECK constraint in
  # db/migrate/20261024063750_add_assessment_status_to_portfolio_skills.rb
  # for why insufficient_evidence can go either way.
  def level_presence_matches_status
    if assessment_status == "not_assessed" && ai_level.present?
      errors.add(:ai_level, "must be blank when assessment_status is not_assessed")
    elsif assessment_status == "assessed" && ai_level.blank?
      errors.add(:ai_level, "can't be blank when assessment_status is assessed")
    end
  end
end
