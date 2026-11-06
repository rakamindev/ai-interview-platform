# frozen_string_literal: true

# JSON for one override history entry (used by the override and portfolio endpoints).
module OverrideEventSerializer
  module_function

  def call(event)
    {
      id:             event.id,
      previous_level: event.previous_level,
      new_level:      event.new_level,
      ai_level:       event.ai_level,
      reason:         event.reason,
      actor_id:       event.actor_id,
      legacy:         event.legacy,
      created_at:     event.created_at
    }
  end
end
