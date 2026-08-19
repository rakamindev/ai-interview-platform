# frozen_string_literal: true

class PortfolioSkill < ApplicationRecord
  include TenantScoped

  CONFIDENCE_LEVELS = %w[high medium low].freeze

  belongs_to :portfolio
  has_one :assessor_override, dependent: :destroy

  validates :skill_label, presence: true
  validates :ai_level, numericality: { only_integer: true, in: 1..5 }, allow_nil: true
  validates :ai_confidence, inclusion: { in: CONFIDENCE_LEVELS }, allow_nil: true
  validates :competency_summary, presence: true, allow_nil: true
  validates :rating_state, inclusion: { in: %w[rated unrated] }

  scope :rated,   -> { where(rating_state: "rated") }
  scope :unrated, -> { where(rating_state: "unrated") }

  def rated?   = rating_state == "rated"
  def unrated? = rating_state == "unrated"

  # evidence is stored as JSONB array of quote strings
  def evidence_quotes
    Array(evidence)
  end
end
