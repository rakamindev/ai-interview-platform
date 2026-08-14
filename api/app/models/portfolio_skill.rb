# frozen_string_literal: true

class PortfolioSkill < ApplicationRecord
  CONFIDENCE_LEVELS = %w[high medium low].freeze
  STATUSES = %w[assessed not_assessed unparseable].freeze

  belongs_to :portfolio
  has_one :assessor_override, dependent: :destroy

  validates :skill_label, presence: true
  validates :status, inclusion: { in: STATUSES }
  # ai_level/ai_confidence only mean something for a skill that was actually
  # assessed — not_assessed/unparseable skills have neither, on purpose.
  validates :ai_level, numericality: { only_integer: true, in: 1..5 }, if: :assessed?
  validates :ai_confidence, inclusion: { in: CONFIDENCE_LEVELS }, if: :assessed?
  validates :competency_summary, presence: true

  scope :assessed,     -> { where(status: 'assessed') }
  scope :not_assessed, -> { where(status: 'not_assessed') }
  scope :unparseable,  -> { where(status: 'unparseable') }

  def assessed?     = status == 'assessed'
  def not_assessed? = status == 'not_assessed'
  def unparseable?  = status == 'unparseable'

  # evidence is stored as JSONB array of quote strings
  def evidence_quotes
    Array(evidence)
  end
end
