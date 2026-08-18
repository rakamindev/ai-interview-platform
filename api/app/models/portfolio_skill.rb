# frozen_string_literal: true

class PortfolioSkill < ApplicationRecord
  CONFIDENCE_LEVELS = %w[high medium low].freeze

  belongs_to :portfolio
  has_one :assessor_override, dependent: :destroy

  validates :skill_label, presence: true
  validates :ai_level, numericality: { only_integer: true, in: 1..5 }
  validates :ai_confidence, inclusion: { in: CONFIDENCE_LEVELS }
  validates :competency_summary, presence: true

  # evidence can be stored as JSONB array of quote strings or objects
  def evidence
    raw = super
    return [] if raw.nil?
    Array(raw).map do |quote|
      quote.is_a?(Hash) ? (quote["quote"] || quote[:quote] || quote.to_s) : quote.to_s
    end
  end

  def evidence_quotes
    evidence
  end
end
