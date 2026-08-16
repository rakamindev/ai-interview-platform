# frozen_string_literal: true

class PortfolioSkill < ApplicationRecord
  CONFIDENCE_LEVELS = %w[high medium low].freeze
  ASSESSMENT_STATUSES = %w[assessed not_assessed].freeze
  NOT_ASSESSED_SUMMARY = 'Not discussed in this session.'

  belongs_to :portfolio
  has_one :assessor_override, dependent: :destroy

  validates :skill_label, presence: true
  validates :assessment_status, inclusion: { in: ASSESSMENT_STATUSES }
  validates :ai_level, numericality: { only_integer: true, in: 1..5 }, allow_nil: true
  validates :ai_confidence, inclusion: { in: CONFIDENCE_LEVELS }, allow_nil: true
  validates :competency_summary, presence: true
  validate :assessed_skill_has_rating

  def evidence_quotes
    Array(evidence)
  end

  def assessed?
    assessment_status == 'assessed'
  end

  def not_assessed?
    assessment_status == 'not_assessed'
  end

  private

  def assessed_skill_has_rating
    return unless assessed?

    if ai_level.nil?
      errors.add(:ai_level, 'must be present for assessed skills')
    end

    if ai_confidence.nil?
      errors.add(:ai_confidence, 'must be present for assessed skills')
    end
  end
end
