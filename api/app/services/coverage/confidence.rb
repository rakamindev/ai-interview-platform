# frozen_string_literal: true

module Coverage
  # Confidence in a skill rating, derived from how much the interview actually probed it.
  # Rule from PRD-01 ("ASSIGN CONFIDENCE"):
  #   high   — probe_count >= 3 AND state = covered
  #   medium — probe_count = 2 OR state = partial
  #   low    — probe_count <= 1 OR state = initiated
  # The PRD rules overlap (e.g. covered with 2 probes). They are checked weakest first, so the
  # weakest matching label wins. not_yet has no confidence: nothing was measured.
  module Confidence
    module_function

    def for(state:, probe_count:)
      return nil if state == 'not_yet'
      return 'low' if probe_count <= 1 || state == 'initiated'
      return 'medium' if probe_count == 2 || state == 'partial'
      return 'high' if state == 'covered' && probe_count >= 3

      'low'
    end
  end
end
