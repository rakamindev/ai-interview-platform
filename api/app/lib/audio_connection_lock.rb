# frozen_string_literal: true

# One live audio websocket per interview. A second tab/window with the same invite
# would open a second Gemini session for the same interview (double cost, interleaved
# transcript). Redis `SET NX EX` works across Puma workers and pods.
#
# The lock expires by itself (TTL) and is renewed while the socket is open, so a crashed
# worker or a dropped connection frees the interview within TTL seconds instead of forever.
class AudioConnectionLock
  TTL         = 30 # seconds
  RENEW_EVERY = 10 # seconds; must stay well below TTL

  def initialize(session_id, redis: nil)
    @key   = "audio_ws:#{session_id}"
    @token = SecureRandom.hex(8)
    @redis = redis || ::Redis.new(url: ENV.fetch('REDIS_URL', 'redis://localhost:6379/1'))
  end

  # true when this connection now owns the interview.
  # Fails open if Redis is down: an outage must not lock candidates out of their interview.
  def acquire
    @redis.set(@key, @token, nx: true, ex: TTL) ? true : false
  rescue StandardError => e
    Rails.logger.error("[AudioLock] acquire failed, allowing connection (#{e.class})")
    true
  end

  def renew
    @redis.expire(@key, TTL) if @redis.get(@key) == @token
  rescue StandardError => e
    Rails.logger.warn("[AudioLock] renew failed (#{e.class})")
  end

  # Only deletes our own lock: after a TTL expiry another connection may hold it now.
  def release
    @redis.del(@key) if @redis.get(@key) == @token
  rescue StandardError => e
    Rails.logger.warn("[AudioLock] release failed (#{e.class})")
  ensure
    @redis.close rescue nil
  end
end
