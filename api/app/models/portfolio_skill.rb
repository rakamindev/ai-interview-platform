# frozen_string_literal: true

class PortfolioSkill < ApplicationRecord
  CONFIDENCE_LEVELS = %w[high medium low].freeze

  belongs_to :portfolio
  has_one :assessor_override, dependent: :destroy

  validates :skill_label, presence: true
  validates :ai_level, numericality: { only_integer: true, in: 1..5 }, allow_nil: true
  validates :ai_confidence, inclusion: { in: CONFIDENCE_LEVELS }, allow_nil: true

  # Probed means a full rating. Unprobed means none at all — an unrated row is
  # the honest record, not a placeholder.
  with_options if: :assessed? do
    validates :ai_level, :ai_confidence, presence: true
    validates :competency_summary, presence: true
  end

  validate :unassessed_carries_no_rating, unless: :assessed?

  # evidence is stored as JSONB array of quote strings
  def evidence_quotes
    Array(evidence)
  end

  private

  def unassessed_carries_no_rating
    errors.add(:ai_level, 'must be blank when the skill was not assessed') if ai_level.present?
    errors.add(:ai_confidence, 'must be blank when the skill was not assessed') if ai_confidence.present?
    errors.add(:evidence, 'must be empty when the skill was not assessed') if evidence_quotes.any?
  end
end
