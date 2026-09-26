# frozen_string_literal: true

class PortfolioSkill < ApplicationRecord
  CONFIDENCE_LEVELS = %w[high medium low].freeze

  # assessed      — rated, with enough evidence
  # thin_evidence — rated, but on little evidence (see caveat)
  # not_assessed  — the interview never reached this skill, so there is no level
  # unavailable   — the model gave no usable level, so there is no level
  STATUSES       = %w[assessed thin_evidence not_assessed unavailable].freeze
  RATED_STATUSES = %w[assessed thin_evidence].freeze
  CAVEATS        = %w[auto_advanced low_probe_count].freeze

  belongs_to :portfolio
  has_one :assessor_override, dependent: :destroy

  validates :skill_label, presence: true
  validates :status, inclusion: { in: STATUSES }
  validates :caveat, inclusion: { in: CAVEATS }, allow_nil: true
  validates :coverage_state, inclusion: { in: CoverageMap::STATES }, allow_nil: true
  validates :ai_level, numericality: { only_integer: true, in: 1..5 }, if: :rated?
  validates :ai_confidence, inclusion: { in: CONFIDENCE_LEVELS }, if: :rated?

  def rated?
    RATED_STATUSES.include?(status)
  end

  # The level anyone may show or use. Always nil for a skill that was not
  # rated, even when an older row still holds a number.
  def rated_level
    ai_level if rated?
  end

  # evidence is stored as JSONB array of quote strings
  def evidence_quotes
    Array(evidence)
  end
end
