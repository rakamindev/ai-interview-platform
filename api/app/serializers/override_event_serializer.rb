# frozen_string_literal: true

# Bentuk JSON satu entri riwayat override, dipakai oleh endpoint override dan portofolio.
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
