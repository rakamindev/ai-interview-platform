# frozen_string_literal: true

module Portfolios
  # Checks whether a quote the AI attributes to the candidate actually appears in what the candidate
  # said. This is TEXTUAL PROVENANCE ONLY: a match shows the words were said, not that they justify
  # the level. Deterministic, no fuzzy "verification".
  #
  # Matching rule:
  #   normalise both sides: Unicode NFKC, lowercase, every non-letter/digit -> space, collapse spaces.
  #   corpus = each candidate turn, and each pair of consecutive candidate turns (an answer is often
  #            split across two transcription turns). Interviewer (AI) turns are never evidence.
  #   transcript_match  - the normalised quote is a substring of a corpus entry (turn_numbers given)
  #   no_exact_match    - no substring match, but >= 60% of the quote's words appear in one candidate
  #                       turn; that turn is only a *suggested* location for a human to check
  #   not_found         - neither
  class QuoteCheck
    SUGGEST_THRESHOLD = 0.6

    def initialize(transcript_turns)
      @candidate_turns = transcript_turns.select { |t| t.speaker == 'candidate' }.sort_by(&:turn_number)
      @corpus = build_corpus
    end

    def check(quote)
      normalised = self.class.normalise(quote)
      return { 'quote' => quote.to_s, 'status' => 'not_found' } if normalised.empty?

      hit = @corpus.find { |entry| entry[:text].include?(normalised) }
      return { 'quote' => quote.to_s, 'status' => 'transcript_match', 'turn_numbers' => hit[:turns] } if hit

      suggested = best_overlap(normalised)
      return { 'quote' => quote.to_s, 'status' => 'no_exact_match', 'suggested_turn' => suggested } if suggested

      { 'quote' => quote.to_s, 'status' => 'not_found' }
    end

    def self.normalise(text)
      text.to_s.unicode_normalize(:nfkc).downcase.gsub(/[^\p{L}\p{N}]+/, ' ').squeeze(' ').strip
    end

    private

    def build_corpus
      singles = @candidate_turns.map { |t| { text: self.class.normalise(t.text), turns: [t.turn_number] } }
      pairs = @candidate_turns.each_cons(2).filter_map do |a, b|
        next unless b.turn_number == a.turn_number + 1

        { text: self.class.normalise("#{a.text} #{b.text}"), turns: [a.turn_number, b.turn_number] }
      end
      singles + pairs
    end

    def best_overlap(normalised)
      words = normalised.split.uniq
      return nil if words.empty?

      scored = @candidate_turns.map do |t|
        turn_words = self.class.normalise(t.text).split.to_set
        [t.turn_number, words.count { |w| turn_words.include?(w) }.fdiv(words.size)]
      end
      turn, score = scored.max_by(&:last)
      score && score >= SUGGEST_THRESHOLD ? turn : nil
    end
  end
end
