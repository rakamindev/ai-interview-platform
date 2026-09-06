# frozen_string_literal: true

module Portfolios
  # Parses the `level` field coming back from the Gemini portfolio response.
  #
  # A missing or malformed level is DATA THAT IS MISSING — it must surface as
  # nil (the skill is rendered as "not yet assessed" downstream), never as the
  # worst rating. The old `level.to_i.clamp(1, 5)` did the opposite on both
  # ends: nil/garbage collapsed to 0 → clamped to 1 (L1, "Foundational"), and
  # an out-of-range 99 was clamped DOWN to 5 (the best rating). Mirror of
  # web/src/utils/constants.ts parseLevel — the two services share one rule:
  # unparseable → null, never an invented level.
  module LevelParser
    VALID_RANGE = (1..5).freeze

    def self.parse(value)
      n =
        case value
        when Integer then value
        when Float   then nil # 2.5 is not a level; don't silently floor it
        else Integer(value.to_s.gsub(/[^\d-]/, ''), exception: false)
        end

      return nil unless VALID_RANGE.cover?(n)

      n
    end
  end
end
