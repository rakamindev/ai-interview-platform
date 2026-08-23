# frozen_string_literal: true

class PortfolioSkill < ApplicationRecord
    CONFIDENCE_LEVELS = %w[high medium low].freeze

    belongs_to :portfolio
    belongs_to :skill_taxonomy
    has_one :assessor_override, dependent: :destroy

    validates :ai_level, numericality: { only_integer: true, in: 1..5 }
    validates :ai_confidence, inclusion: { in: CONFIDENCE_LEVELS }
    validates :competency_summary, presence: true

    default_scope { includes(:skill_taxonomy) }

    # evidence is stored as JSONB array of quote strings
    def evidence_quotes
        Array(evidence)
    end
end
