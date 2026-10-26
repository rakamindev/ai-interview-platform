# frozen_string_literal: true

module Sessions
  # F17: when a candidate's browser drops, the audio socket keeps the session alive for a grace
  # period so a refresh can resume it. Each socket has its own in-memory state, and with Puma in
  # cluster mode the rejoin may land on another worker process, so "did the candidate come back?"
  # is recorded in Redis, shared by all workers.
  module ConnectionTracker
    TTL = 6 * 60 * 60 # longer than any interview

    module_function

    def connected!(session_id, at: Time.current)
      Sidekiq.redis { |r| r.call('SET', key(session_id), at.to_f.to_s, 'EX', TTL) }
    end

    # True if a browser connected to this session after +time+.
    def reconnected_after?(session_id, time)
      last = Sidekiq.redis { |r| r.call('GET', key(session_id)) }
      last.present? && last.to_f > time.to_f
    end

    def key(session_id) = "audio_ws:session:#{session_id}:connected_at"
  end
end
