# frozen_string_literal: true

module Portfolios
  # Reads skill ratings out of free-form model output without ever inventing one.
  # Anything that is not clearly a level 1..5 means "not assessed" (nil), not L1.
  module RatingParser
    LEVEL_PATTERN = /\AL?\s*([1-5])(?:\.0+)?\z/i
    CONFIDENCE_LEVELS = PortfolioSkill::CONFIDENCE_LEVELS

    module_function

    # 3, 3.0, "3", "L3", "l3", " L3 " -> 3; nil, "N/A", 0, 6, 3.7, "L3+" -> nil
    def level(value)
      case value
      when Integer
        value if value.between?(1, 5)
      when Float
        value.to_i if value.finite? && value == value.floor && value.between?(1, 5)
      when String
        value.strip.match(LEVEL_PATTERN)&.captures&.first&.to_i
      end
    end

    # Unknown values become "low": an unreadable confidence must never read as certainty.
    def confidence(value)
      normalized = value.to_s.strip.downcase
      CONFIDENCE_LEVELS.include?(normalized) ? normalized : 'low'
    end
  end
end
