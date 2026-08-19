# frozen_string_literal: true

class PortfolioSkill < ApplicationRecord
  CONFIDENCE_LEVELS = %w[high medium low].freeze
  NOT_ASSESSED_SUMMARY = 'This skill was not assessed during the interview. No level was assigned.'.freeze

  belongs_to :portfolio
  has_one :assessor_override, dependent: :destroy

  validates :skill_label, presence: true
  validates :assessed, inclusion: { in: [true, false] }
  # Level/confidence are only meaningful for assessed skills.
  validates :ai_level, numericality: { only_integer: true, in: 1..5 }, if: :assessed?
  validates :ai_confidence, inclusion: { in: CONFIDENCE_LEVELS }, if: :assessed?
  validates :competency_summary, presence: true

  # When not assessed, the summary must be present but we never fabricate a
  # rating — level and confidence stay nil and the UI renders them as such.
  scope :assessed, -> { where(assessed: true) }
  scope :unassessed, -> { where(assessed: false) }

  def assessed? = assessed

  # evidence is stored as JSONB array of quote strings
  def evidence_quotes
    Array(evidence)
  end

  def self.not_assessed_summary
    NOT_ASSESSED_SUMMARY
  end
end
