# frozen_string_literal: true

class PortfolioSkill < ApplicationRecord
  CONFIDENCE_LEVELS = %w[high medium low].freeze

  belongs_to :portfolio
  has_one :assessor_override, dependent: :destroy

  before_validation :normalize_attributes

  validates :skill_label, presence: true
  validates :ai_level, numericality: { only_integer: true, in: 1..5 }, allow_nil: true
  validates :ai_confidence, inclusion: { in: CONFIDENCE_LEVELS }, allow_nil: true
  validates :competency_summary, presence: true, unless: :not_assessed?
  validate  :level_xor_not_assessed

  # evidence is stored as JSONB array of quote strings
  def evidence_quotes
    Array(evidence)
  end

  private

  def normalize_attributes
    self.competency_summary ||= ''
    self.evidence ||= []
  end

  def level_xor_not_assessed
    if ai_level.nil? && !not_assessed
      errors.add(:ai_level, 'must be present when skill is assessed')
    end
    if ai_level.present? && not_assessed
      errors.add(:not_assessed, 'cannot be true when ai_level is set')
    end
  end
end
