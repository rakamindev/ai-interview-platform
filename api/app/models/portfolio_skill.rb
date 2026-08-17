# frozen_string_literal: true

class PortfolioSkill < ApplicationRecord
  CONFIDENCE_LEVELS = %w[high medium low].freeze

  belongs_to :portfolio
  has_one :assessor_override, dependent: :destroy

  validates :skill_label, presence: true
  validates :ai_level, numericality: { only_integer: true, in: 1..5 }, allow_nil: true
  validates :ai_confidence, inclusion: { in: CONFIDENCE_LEVELS }, allow_nil: true
  validates :competency_summary, presence: true

  # evidence is stored as JSONB array of quote strings
  def evidence_quotes
    Array(evidence)
  end

  # An evaluation is actionable only if it has a valid level AND at least one
  # piece of verified evidence AND acceptable confidence. Everything else must
  # be reviewed by a human.
  def requires_review?
    ai_level.blank? || !verified_evidence? || insufficient_evidence? || ai_confidence == 'low'
  end

  def insufficient_evidence?
    assessor_override&.insufficient_evidence? || false
  end

  def verified_evidence?
    provenance = evidence_provenance || []
    return false if provenance.empty?

    provenance.any? { |p| p['verified'] == true }
  end

  # Reasons this skill is flagged for human review, for API consumers.
  def review_reasons
    reasons = []
    reasons << 'no_valid_level' if ai_level.blank?
    reasons << 'low_confidence' if ai_confidence == 'low'
    reasons << 'unverified_evidence' unless verified_evidence?
    reasons << 'insufficient_evidence' if insufficient_evidence?
    reasons
  end

  # The effective level after any assessor review (nil = not assessed).
  def effective_level
    return ai_level unless assessor_override

    assessor_override.effective_level
  end
end
