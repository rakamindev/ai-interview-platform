# frozen_string_literal: true

module Coverage
  # Deterministic confidence derivation per PRD-01 (portfolio prompt rules):
  #
  #   high   — probe_count >= 3 AND state = covered
  #   medium — probe_count = 2 OR state = partial
  #   low    — probe_count <= 1 OR state = initiated
  #
  # Confidence is a property of the interview evidence (coverage map), NOT of
  # the model's self-report. Gemini's claimed confidence is not trusted; it is
  # recomputed from the final coverage state before it is stored.
  class ConfidenceCalculator
    # @param state [String, nil] coverage state for the skill
    # @param probe_count [Integer, nil] number of probing exchanges
    # @return [String] 'high' | 'medium' | 'low'
    def self.call(state: nil, probe_count: nil)
      new(state: state, probe_count: probe_count).call
    end

    def initialize(state: nil, probe_count: nil)
      @state       = state&.to_s
      @probe_count = probe_count.to_i
    end

    def call
      return 'low' if unknown_coverage?

      if @state == 'covered' && @probe_count >= 3
        'high'
      elsif @probe_count == 2 || @state == 'partial'
        'medium'
      else
        'low'
      end
    end

    private

    def unknown_coverage?
      @state.blank? || !%w[not_yet initiated partial covered].include?(@state)
    end
  end
end
