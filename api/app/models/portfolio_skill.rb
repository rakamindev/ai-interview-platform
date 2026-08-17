# frozen_string_literal: true

class PortfolioSkill < ApplicationRecord
  CONFIDENCE_LEVELS = %w[high medium low].freeze

  belongs_to :portfolio
  has_one :assessor_override, dependent: :destroy

  validates :skill_label, presence: true
  validates :ai_level, numericality: { only_integer: true, in: 1..5 }
  validates :ai_confidence, inclusion: { in: CONFIDENCE_LEVELS }
  validates :competency_summary, presence: true

  # evidence is stored as JSONB — either plain strings (legacy) or
  # { "text" => "...", "turn_number" => N } objects.
  def evidence_quotes
    Array(evidence)
  end

  # Always returns normalized evidence as [{ "text" => ..., "turn_number" => ... }].
  # Wraps legacy string entries so callers get a consistent shape.
  def normalized_evidence
    Array(evidence).map do |e|
      if e.is_a?(Hash)
        { 'text' => e['text'] || e[:text], 'turn_number' => e['turn_number'] || e[:turn_number] }
      else
        { 'text' => e, 'turn_number' => nil }
      end
    end
  end
end
