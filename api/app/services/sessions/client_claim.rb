# frozen_string_literal: true

module Sessions
  # Decides which browser may run an interview. Invite links are bearer links, so the first browser
  # to start one owns it; the same browser may rejoin (refresh, socket reconnect) and an assessor can
  # reset access for a candidate who lost that browser.
  #
  # Each change runs as one Lua script on one Redis hash, so owner, reset and the live connection
  # stay consistent across Puma workers: a browser whose access was reset cannot register afterwards,
  # and a grace-period end cannot slip past a connection that has just rejoined.
  class ClientClaim
    # Raised when the claim store cannot be reached. Callers must fail closed: admitting a browser
    # without a claim would let two browsers share one interview.
    class Unavailable < StandardError; end

    CLIENT_ID_FORMAT = /\A[0-9a-f]{32}\z/
    RESET_ID_FORMAT = /\A[0-9a-f]{32}\z/
    # Outlives the interview (time limit plus time-ceiling and reconnect grace). Ended sessions are
    # rejected before the claim is checked, so expiry after the interview is harmless.
    TTL_BUFFER = 1.hour
    # How long a disconnected candidate has to rejoin. Live probes resumed a Gemini session after 2
    # minutes but were rejected after 5, so a longer window would need another way to restore context.
    RECONNECT_GRACE = 120

    def initialize(session)
      @session = session
    end

    # Returns this connection's token, :taken when another browser holds the interview (or this one
    # was reset), or :closing when the grace period has already ended it.
    def admit(client_id)
      return :taken unless client_id.is_a?(String) && client_id.match?(CLIENT_ID_FORMAT)

      run_admit(client_id)
    end

    # For assessor connections authenticated by JWT, which have no browser to bind.
    def admit_without_owner
      run_admit('')
    end

    # Revokes the current browser. Returns [connection_token, deadline], or nil when nobody has connected.
    def reset(reset_id)
      token, deadline = with_redis do |redis|
        redis.eval(ClientClaimScripts::RESET, keys: [key],
                                              argv: [reset_id, SecureRandom.hex(16), grace_deadline, ttl])
      end
      [token, deadline.to_i] if token
    end

    # Records that this connection's browser left. Returns the end deadline, or nil when a newer
    # connection has already replaced this one.
    def disconnected(token)
      deadline = with_redis do |redis|
        redis.eval(ClientClaimScripts::DISCONNECT, keys: [key], argv: [token, grace_deadline])
      end
      deadline&.to_i
    end

    # A missing connection means Redis lost the claim, not that anyone took over, so the live interview
    # continues; the next browser to register takes the field and this check then fires.
    def replaced?(token)
      current = with_redis { |redis| redis.hget(key, 'connection') }
      current.present? && current != token
    end

    # Atomically blocks new connections if this one is still the latest, so the caller may end the session.
    def finalize(token) # rubocop:disable Naming/PredicateMethod
      with_redis { |redis| redis.eval(ClientClaimScripts::FINALIZE, keys: [key], argv: [token]) } == 1
    end

    def schedule_end(token, deadline)
      SessionGraceEndWorker.perform_at(deadline, @session.id, token)
    rescue ::RedisClient::Error, ::Redis::BaseError => e
      Rails.logger.error("[ClientClaim] Could not schedule the end of session #{@session.id}: #{e.message}")
      raise Unavailable, e.message
    end

    # Advisory only (drives the candidate page); the socket admission is the enforcement point.
    def claimed_by_other?(client_id)
      owner, revoked = with_redis { |redis| redis.hmget(key, 'owner', "revoked:#{client_id}") }
      revoked.present? || (owner.present? && owner != client_id)
    rescue Unavailable
      false
    end

    private

    def run_admit(client_id)
      result = with_redis do |redis|
        redis.eval(ClientClaimScripts::ADMIT, keys: [key], argv: [client_id, SecureRandom.hex(16), ttl])
      end
      %w[taken closing].include?(result) ? result.to_sym : result
    end

    def key
      "interview_access:#{@session.id}"
    end

    def ttl
      (@session.assessment.time_limit_min.minutes + TTL_BUFFER).to_i
    end

    def grace_deadline
      Time.current.to_i + RECONNECT_GRACE
    end

    def with_redis
      redis = ::Redis.new(url: ENV.fetch('REDIS_URL'))
      yield redis
    rescue ::Redis::BaseError => e
      Rails.logger.error("[ClientClaim] Redis unavailable for session #{@session.id}: #{e.message}")
      raise Unavailable, e.message
    ensure
      redis&.close
    end
  end
end
