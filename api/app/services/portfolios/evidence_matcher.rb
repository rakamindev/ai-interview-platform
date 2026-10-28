# frozen_string_literal: true

module Portfolios
  # Checks that an evidence quote returned by the model was actually said by the
  # candidate, and finds the transcript turn it came from.
  #
  # Quotes come back from the model with small edits (curly quotes, trimmed
  # punctuation, changed casing), so matching is done on normalized text.
  # A quote matches a turn when its normalized form is a substring of the turn,
  # or when at least MIN_TOKEN_COVERAGE of its words appear in order within a
  # window of the turn barely longer than the quote (tolerates a dropped filler
  # word such as "um" or "like", but not words scattered across a long answer).
  class EvidenceMatcher
    MIN_TOKEN_COVERAGE = 0.85
    MIN_QUOTE_TOKENS   = 3
    WINDOW_SLACK       = 1.25

    Match = Struct.new(:quote, :turn_number, keyword_init: true)

    # candidate_turns: objects responding to #turn_number and #text,
    # already filtered to the candidate speaker.
    def initialize(candidate_turns)
      @turns = candidate_turns.map { |t| [t.turn_number, tokens(t.text)] }
    end

    # Returns a Match, or nil when the quote cannot be found.
    def match(quote)
      return nil unless quote.is_a?(String)

      quote_tokens = tokens(quote)
      return nil if quote_tokens.size < MIN_QUOTE_TOKENS

      @turns.each do |turn_number, turn_tokens|
        if contains?(turn_tokens, quote_tokens)
          return Match.new(quote: clean_display(quote), turn_number: turn_number)
        end
      end
      nil
    end

    private

    def tokens(text)
      text.to_s.unicode_normalize(:nfkc).downcase
          .gsub(/[^\p{L}\p{N}\s]/, ' ')
          .split
    end

    def contains?(turn_tokens, quote_tokens)
      return true if turn_tokens.each_cons(quote_tokens.size).any? { |w| w == quote_tokens }

      # The fuzzy match is confined to a window barely longer than the quote.
      # Matching across the whole turn would let a long answer "contain" any
      # fabricated sentence built from common words.
      window = [(quote_tokens.size * WINDOW_SLACK).ceil, turn_tokens.size].min
      turn_tokens.each_cons(window).any? do |slice|
        ordered_coverage(slice, quote_tokens) >= MIN_TOKEN_COVERAGE
      end
    end

    # Fraction of quote tokens found in the window, in order, without crossing
    # back over earlier matches.
    def ordered_coverage(turn_tokens, quote_tokens)
      cursor = 0
      found  = 0
      quote_tokens.each do |token|
        idx = (cursor...turn_tokens.size).find { |i| turn_tokens[i] == token }
        next unless idx

        found += 1
        cursor = idx + 1
      end
      found.to_f / quote_tokens.size
    end

    def clean_display(quote)
      quote.strip.delete_prefix('"').delete_suffix('"').strip
    end
  end
end
