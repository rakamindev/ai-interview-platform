# frozen_string_literal: true

module Coverage
  # Validates coverage state transitions and enforces hard rules.
  # All transitions are forward-only and probe_count gated.
  class StateEngine
    STATES = %w[not_yet initiated partial covered].freeze

    VALID_TRANSITIONS = {
      'not_yet'   => %w[initiated],
      'initiated' => %w[partial],
      'partial'   => %w[covered],
      'covered'   => []
    }.freeze

    # Returns true if a transition from `from` to `to` is valid given probe_count.
    def self.valid_transition?(from:, to:, probe_count:)
      return false unless VALID_TRANSITIONS[from]&.include?(to)

      # HARD RULE: cannot advance past initiated without at least 2 probes
      if to == 'partial' || to == 'covered'
        return false if probe_count < 2
      end

      true
    end

    # Given a proposed update from N7, returns the safe state to apply.
    # The result advances AT MOST one state forward per call. Skipping steps
    # is still impossible (VALID_TRANSITIONS only allows adjacent states),
    # and crucially: each new state must be earned by probes made *after
    # entering* the previous one. The old implementation replayed the same
    # probe_count at every rung of the ladder, so a single call with
    # probe_count == 2 pushed not_yet → initiated → partial → covered at
    # once — the HARD RULE gate could never fail because it was never
    # re-evaluated against probes made inside the states it waved through.
    # One step per turn is the safe floor: the next transcript turn gets a
    # fresh resolve_state call and can advance one more rung if evidence
    # still supports it.
    def self.resolve_state(current_state:, proposed_state:, probe_count:)
      return current_state if current_state == proposed_state

      current_idx  = STATES.index(current_state) || 0
      proposed_idx = STATES.index(proposed_state)

      # Unknown proposed state — don't change
      return current_state unless proposed_idx && proposed_idx > current_idx

      candidate = STATES[current_idx + 1]
      return current_state unless valid_transition?(from: current_state, to: candidate, probe_count: probe_count)

      candidate
    end
  end
end
