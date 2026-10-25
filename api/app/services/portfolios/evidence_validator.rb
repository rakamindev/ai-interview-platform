# frozen_string_literal: true

module Portfolios
  class EvidenceValidator
    MAX_EXCERPT_GRAPHEMES = 320
    TOKEN_PATTERN = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/u

    def initialize(session:)
      @session = session
    end

    def call(proposals)
      citations = []
      rejections = Hash.new(0)

      Array(proposals).first(3).each do |proposal|
        citation, reason = validate(proposal)
        citation ? citations << citation : rejections[reason] += 1
      end

      { citations:, rejections: }
    end

    private

    def validate(proposal)
      return [nil, :invalid_shape] unless proposal.is_a?(Hash)

      turn_number = value(proposal, :turn_number).to_i
      proposed_quote = value(proposal, :quote).to_s
      return [nil, :missing_turn] unless turn_number.positive?
      return [nil, :missing_quote] if proposed_quote.strip.empty?

      turn = @session.transcript_turns.find_by(turn_number:)
      return [nil, :missing_turn] unless turn
      return [nil, :wrong_speaker] unless turn.speaker == 'candidate'

      excerpt = canonical_excerpt(turn.text, proposed_quote)
      return [nil, :quote_mismatch] unless excerpt

      [{
        'turn_id' => turn.id,
        'turn_number' => turn.turn_number,
        'quote' => excerpt,
        'verification_status' => 'verified'
      }, nil]
    end

    def value(hash, key)
      hash[key.to_s] || hash[key]
    end

    def canonical_excerpt(source, proposal)
      source_tokens = token_spans(source)
      proposal_values = token_spans(proposal).map { |token| token[:value] }
      return if proposal_values.empty? || proposal_values.length > source_tokens.length

      start_index = source_tokens.each_index.find do |index|
        source_tokens[index, proposal_values.length]&.map { |token| token[:value] } == proposal_values
      end
      return unless start_index

      first_token = source_tokens[start_index]
      last_token = source_tokens[start_index + proposal_values.length - 1]
      excerpt = source[first_token[:start]...last_token[:finish]]
      excerpt.scan(/\X/).first(MAX_EXCERPT_GRAPHEMES).join
    end

    def token_spans(text)
      text.to_s.to_enum(:scan, TOKEN_PATTERN).map do
        match = Regexp.last_match
        {
          value: match[0].unicode_normalize(:nfkc).downcase.delete("'’"),
          start: match.begin(0),
          finish: match.end(0)
        }
      end
    end
  end
end
