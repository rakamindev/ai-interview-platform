# frozen_string_literal: true

module Sessions
  # Binds an invite link to the first browser that starts the interview, so a shared link cannot be
  # used by a second person. The same browser may claim again (page refresh, socket reconnect).
  # Redis SET NX is atomic across Puma workers, so two simultaneous starts cannot both win.
  class ClientClaim
    # Raised when the claim store cannot be reached. Callers must fail closed: admitting a browser
    # without a claim would let two browsers share one interview.
    class Unavailable < StandardError; end

    CLIENT_ID_FORMAT = /\A[0-9a-f]{32}\z/
    # Outlives the interview (time limit plus time-ceiling and reconnect grace). Ended sessions are
    # rejected before the claim is checked, so expiry after the interview is harmless.
    TTL_BUFFER = 1.hour

    def initialize(session)
      @session = session
    end

    def claim(client_id)
      return false unless client_id.is_a?(String) && client_id.match?(CLIENT_ID_FORMAT)

      with_redis do |redis|
        redis.set(key, client_id, nx: true, ex: ttl) || redis.get(key) == client_id
      end
    end

    # Advisory only (drives the candidate page); the socket claim is the enforcement point.
    def claimed_by_other?(client_id)
      owner = with_redis { |redis| redis.get(key) }
      owner.present? && owner != client_id
    rescue Unavailable
      false
    end

    private

    def key
      "interview_client:#{@session.id}"
    end

    def ttl
      (@session.assessment.time_limit_min.minutes + TTL_BUFFER).to_i
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
