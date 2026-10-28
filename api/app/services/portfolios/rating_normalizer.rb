# frozen_string_literal: true

module Portfolios
  # Turns one skill entry from the model output into PortfolioSkill attributes.
  #
  # Rules (D-1, D-7):
  # - a level is kept only when the skill was probed (coverage partial or
  #   covered), the model returned an integer 1..5, and at least one evidence
  #   quote exists ("no evidence, no level"); otherwise the skill is
  #   not assessed with a reason, never coerced to a level
  # - confidence is computed from the coverage map (PRD-01 section 5), not
  #   taken from the model
  #
  # Returns nil when the entry has no usable skill label.
  class RatingNormalizer
    RATED_COVERAGE_STATES = %w[partial covered].freeze
    MAX_EVIDENCE   = 3
    MAX_LABEL      = 255
    LEVEL_PATTERN  = /\A[1-5]\z/

    def self.call(skill_data, coverage:)
      new(skill_data, coverage).call
    end

    def initialize(skill_data, coverage)
      @data     = skill_data.is_a?(Hash) ? skill_data : {}
      @coverage = coverage
    end

    def call
      label = normalized_label
      return nil if label.nil?

      evidence = normalized_evidence
      reason   = not_assessed_reason(evidence)

      {
        skill_id: normalized_skill_id,
        skill_label: label,
        evidence: reason == 'no_evidence' ? [] : evidence,
        competency_summary: @data['competency_summary'].is_a?(String) ? @data['competency_summary'] : '',
        coverage_state: @coverage&.state,
        probe_count: @coverage&.probe_count
      }.merge(rating(reason))
    end

    private

    def rating(reason)
      if reason
        { rating_status: 'not_assessed', not_assessed_reason: reason, ai_level: nil, ai_confidence: nil }
      else
        { rating_status: 'assessed', not_assessed_reason: nil, ai_level: parsed_level, ai_confidence: confidence }
      end
    end

    # The order matters: an unprobed skill is "not covered" whatever the model said.
    def not_assessed_reason(evidence)
      return 'not_covered' unless RATED_COVERAGE_STATES.include?(@coverage&.state)
      return 'no_level_from_model' if @data['level'].nil?
      return 'invalid_level_from_model' if parsed_level.nil?
      return 'no_evidence' if evidence.empty?

      nil
    end

    def parsed_level
      raw = @data['level']
      return raw if raw.is_a?(Integer) && raw.between?(1, 5)
      return raw.to_i if raw.is_a?(String) && raw.strip.match?(LEVEL_PATTERN)

      nil
    end

    # PRD-01 section 5: high = probe_count >= 3 and covered;
    # low = probe_count <= 1 or initiated; medium otherwise (2 probes or partial).
    def confidence
      probes = @coverage.probe_count.to_i
      return 'high' if @coverage.state == 'covered' && probes >= 3
      return 'low' if probes <= 1

      'medium'
    end

    def normalized_evidence
      raw = @data['evidence']
      quotes = raw.is_a?(String) ? [raw] : raw
      return [] unless quotes.is_a?(Array)

      quotes.select { |quote| quote.is_a?(String) && quote.strip.present? }.first(MAX_EVIDENCE)
    end

    def normalized_label
      raw = @data['skill_label']
      return nil unless raw.is_a?(String) && raw.strip.present?

      label = raw.strip
      label.length > MAX_LABEL ? "#{label[0, MAX_LABEL - 3]}..." : label
    end

    def normalized_skill_id
      raw = @data['skill_id']
      raw.is_a?(String) && raw.strip.present? ? raw.strip[0, 50] : nil
    end
  end
end
