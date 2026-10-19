# frozen_string_literal: true

module Sessions
  # Authorizes POST /sessions/:token/audio_complete to end as `all_covered`.
  #
  # The audio WebSocket sets a short-lived Redis flag when it sends
  # `preparing_to_end` (after coverage was verified in-process). This avoids
  # false negatives from async coverage DB lag while blocking arbitrary HTTP calls
  # that skip the interview flow (PD-005).
  class AutoEndGate
    KEY_TEMPLATE = 'session:%<id>s:auto_end_allowed'
    TTL_SECONDS  = 600

    class << self
      def permit!(session_id)
        Sidekiq.redis { |conn| conn.setex(redis_key(session_id), TTL_SECONDS, '1') }
      end

      def clear!(session_id)
        Sidekiq.redis { |conn| conn.del(redis_key(session_id)) }
      end

      def permitted?(session)
        session.reload
        return true if Coverage::MapInjector.new(session).all_covered?

        Sidekiq.redis { |conn| conn.get(redis_key(session.id)) }.present?
      end

      private

      def redis_key(session_id)
        format(KEY_TEMPLATE, id: session_id)
      end
    end
  end
end
