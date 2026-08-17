# frozen_string_literal: true

class PortfolioSkill < ApplicationRecord
  CONFIDENCE_LEVELS = %w[high medium low].freeze

  belongs_to :portfolio
  has_one :assessor_override, dependent: :restrict_with_error

  enum :rating_status, { rated: 'rated', unrated: 'unrated' }

  validates :skill_label, presence: true

  with_options if: :rated? do |rated|
    rated.validates :ai_level, numericality: { only_integer: true, in: 1..5 }
    rated.validates :ai_confidence, inclusion: { in: CONFIDENCE_LEVELS }
    rated.validates :competency_summary, presence: true
  end

  with_options if: :unrated? do |unrated|
    unrated.validates :ai_level, absence: true
    unrated.validates :unrated_reason, presence: true
  end

  # evidence is stored as JSONB array of quote strings
  def evidence_quotes
    Array(evidence)
  end
end
