# frozen_string_literal: true

class CoverageMapSerializer
  def initialize(map)
    @map = map
  end

  def as_json(**)
    {
      id:            map.id,
      skill_id:      map.skill_id,
      skill_label:   map.skill_label,
      is_discovered: map.is_discovered,
      state:         map.state,
      probe_count:   map.probe_count,
      last_signal:   map.last_signal,
      updated_at:    map.updated_at
    }
  end

  private

  attr_reader :map
end
