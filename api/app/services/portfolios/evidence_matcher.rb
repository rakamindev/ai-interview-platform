# frozen_string_literal: true

module Portfolios
  # Checks that a quote the model cites as evidence was really said by the
  # candidate, and finds the transcript turn it came from.
  #
  # Matching is tolerant of what models typically change (case, punctuation,
  # curly quotes, whitespace, "..." between fragments) but not of paraphrase:
  # every fragment must appear word for word in a single candidate turn.
  class EvidenceMatcher
    MIN_WORDS = 3
    MAX_QUOTE_LENGTH = 500

    def initialize(turns)
      @candidate_turns = turns.select { |t| t.speaker == 'candidate' }
                              .map { |t| [t.turn_number, " #{normalize(t.text)} "] }
    end

    # Returns { quote:, turn_number: } or nil when the quote can't be found.
    def match(quote)
      text = quote.to_s.strip.gsub(/\A["“”'‘’]+|["“”'‘’]+\z/, '').strip
      return if text.blank?

      fragments = text.split(/\.{3}|…/).map { |f| normalize(f) }.reject(&:empty?)
      return if fragments.empty?
      return if fragments.sum { |f| f.split.size } < MIN_WORDS

      turn_number, = @candidate_turns.find do |_number, turn_text|
        # Padded with spaces so a fragment can't match half a word.
        fragments.all? { |f| turn_text.include?(" #{f} ") }
      end
      return unless turn_number

      { quote: text.truncate(MAX_QUOTE_LENGTH), turn_number: }
    end

    private

    def normalize(text)
      text.to_s.downcase.gsub(/[^\p{L}\p{N}\s]/, ' ').squish
    end
  end
end
