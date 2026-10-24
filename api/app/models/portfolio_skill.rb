# frozen_string_literal: true

class PortfolioSkill < ApplicationRecord
  CONFIDENCE_LEVELS = %w[high medium low].freeze

  STATUSES = %w[assessed unassessed].freeze

  belongs_to :portfolio
  has_one :assessor_override, dependent: :destroy

  validates :skill_label, presence: true
  validates :ai_level, numericality: { only_integer: true, in: 1..5 }, allow_nil: true
  validates :ai_confidence, inclusion: { in: CONFIDENCE_LEVELS }
  validates :status, inclusion: { in: STATUSES }
  validates :competency_summary, presence: true

  scope :assessed,   -> { where(status: 'assessed').where.not(ai_level: nil) }
  scope :unassessed, -> { where("status = 'unassessed' OR ai_level IS NULL") }

  def unassessed?
    status == 'unassessed' || ai_level.nil?
  end

  # evidence is stored as JSONB array of quote strings
  def evidence_quotes
    Array(evidence)
  end
end
