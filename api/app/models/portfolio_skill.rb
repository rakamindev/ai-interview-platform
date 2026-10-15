# frozen_string_literal: true

class PortfolioSkill < ApplicationRecord
  CONFIDENCE_LEVELS = %w[high medium low].freeze
  RATING_STATUSES   = %w[rated not_assessed insufficient_evidence].freeze

  belongs_to :portfolio
  has_one :assessor_override, dependent: :destroy

  validates :skill_label, presence: true
  validates :rating_status, inclusion: { in: RATING_STATUSES }
  validates :ai_level, numericality: { only_integer: true, in: 1..5 }, if: :rated?
  validates :ai_level, absence: true, unless: :rated?
  validates :ai_confidence, inclusion: { in: CONFIDENCE_LEVELS }
  validates :competency_summary, presence: true

  def rated? = rating_status == 'rated'

  # Level used for decisions: the assessor's override wins over the AI.
  def effective_level
    assessor_override&.override_level || ai_level
  end

  # Evidence is stored as JSONB. Older rows hold plain strings; rows written
  # since evidence verification hold { quote, turn_number } objects.
  def evidence_quotes
    Array(evidence).map do |item|
      if item.is_a?(Hash)
        { quote: item['quote'] || item[:quote], turn_number: item['turn_number'] || item[:turn_number] }
      else
        { quote: item.to_s, turn_number: nil }
      end
    end
  end

  # Stable key for matching the same skill across regenerations and vacancies.
  def self.identity_key(skill_id:, skill_label:)
    skill_id.present? ? "id:#{skill_id}" : "label:#{normalize_label(skill_label)}"
  end

  def self.normalize_label(label)
    label.to_s.downcase.gsub(/[^a-z0-9]+/, ' ').strip
  end

  def identity_key
    self.class.identity_key(skill_id:, skill_label:)
  end
end
