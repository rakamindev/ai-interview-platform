# frozen_string_literal: true

module Portfolios
  # Answers one question: "was this skill actually discussed in the interview?"
  #
  # The answer comes from the final coverage map, which the interview loop already
  # maintains. `state == 'not_yet'` means the AI never probed the skill, so there is
  # no evidence to score against.
  #
  # Deliberately duck-typed: it accepts anything responding to #skill_id,
  # #skill_label and #state, so it can be unit tested without a database.
  class CoverageLookup
    NOT_DISCUSSED_STATE = 'not_yet'

    def initialize(coverage_maps)
      @by_id    = {}
      @by_label = {}

      Array(coverage_maps).each do |map|
        id = map.skill_id.to_s.strip
        @by_id[id] = map unless id.empty?
        @by_label[normalize(map.skill_label)] = map
      end
    end

    # Safe-fail direction: no coverage row at all counts as "never discussed", so a
    # bookkeeping gap can only ever drop a skill (Fit/Gap renders it `not_assessed`),
    # never invent a score for one.
    def discussed?(skill_id: nil, skill_label: nil)
      map = find(skill_id, skill_label)
      return false if map.nil?

      map.state.to_s != NOT_DISCUSSED_STATE
    end

    def state_for(skill_id: nil, skill_label: nil)
      find(skill_id, skill_label)&.state
    end

    private

    def find(skill_id, skill_label)
      id = skill_id.to_s.strip
      return @by_id[id] if !id.empty? && @by_id.key?(id)

      @by_label[normalize(skill_label)]
    end

    def normalize(label)
      label.to_s.downcase.strip.gsub(/\s+/, ' ')
    end
  end
end
