# frozen_string_literal: true

module Portfolios
  # A quote must contain enough candidate speech to be meaningful. Distinct
  # fragments of one answer never count as independent assessment evidence.
  class EvidenceVerifier
    MIN_CHARACTERS = 15
    MIN_WORDS = 3

    def self.normalize(value)
      value.to_s.gsub(/[“”"']/, '').squish.downcase
    end

    def self.substantive?(quote)
      normalized = normalize(quote)
      normalized.length >= MIN_CHARACTERS && normalized.scan(/[[:alnum:]]+/).length >= MIN_WORDS
    end

    def self.present_in_turns?(quote, candidate_turns)
      return false unless substantive?(quote)

      normalized = normalize(quote)
      candidate_turns.any? { |turn| normalize(turn).include?(normalized) }
    end

    def self.verified_count(quotes, candidate_turns)
      turns = candidate_turns.map { |turn| normalize(turn) }
      distinct_quotes = Array(quotes).map { |quote| normalize(quote) }.uniq
      candidates = distinct_quotes.select { |quote| substantive?(quote) }
      possible_turns = candidates.map do |quote|
        turns.each_index.select { |index| turns[index].include?(quote) }
      end

      # Maximum matching: each accepted quote and each candidate turn can be
      # counted once. At most three quotes are supplied by the validator.
      assigned = {}
      possible_turns.each_index.count do |quote_index|
        assign = lambda do |index, seen|
          possible_turns[index].any? do |turn_index|
            next false if seen[turn_index]

            seen[turn_index] = true
            if !assigned.key?(turn_index) || assign.call(assigned[turn_index], seen)
              assigned[turn_index] = index
              true
            else
              false
            end
          end
        end
        assign.call(quote_index, {})
      end
    end
  end
end
