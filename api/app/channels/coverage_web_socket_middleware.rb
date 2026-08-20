# frozen_string_literal: true

require 'faye/websocket'

# Rack middleware for assessor live coverage monitoring at /ws/sessions/:id/coverage.
# Server-push only: subscribes to Redis pub/sub and forwards coverage updates to the assessor.
class CoverageWebSocketMiddleware
  COVERAGE_PATH_PATTERN = %r{\A/ws/sessions/([^/]+)/coverage\z}

  def initialize(app)
    @app = app
  end

  def call(env)
    path  = env['PATH_INFO']
    match = COVERAGE_PATH_PATTERN.match(path)

    return @app.call(env) unless match && Faye::WebSocket.websocket?(env)

    session_id = match[1]
    handle_coverage_websocket(env, session_id)
  end

  private

  def handle_coverage_websocket(env, session_id)
    ws = Faye::WebSocket.new(env, nil, ping: 30)

    redis_sub = nil  # track subscription Redis instance for cleanup

    ws.on :open do |_event|
      # Try header-based auth first (assessor dashboard with JWT in header).
      # If no Authorization header is present, wait for a { type: "auth", token }
      # message — this matches the pattern used by the audio WS for browser clients
      # that can't set WebSocket headers.
      session, error = authenticate_assessor(env, session_id)
      next if error  # wait for auth message

      send_current_state(ws, session)
      redis_sub = subscribe_to_coverage_updates(ws, session_id)
    end

    ws.on :message do |event|
      next unless event.data.is_a?(String)

      message = JSON.parse(event.data) rescue next
      next unless message['type'] == 'auth'

      # Already authenticated via header — ignore
      next if redis_sub

      token   = message['token'].to_s
      session, error = authenticate_assessor_by_token(token, session_id)

      if error
        ws.send({ type: 'error', code: 'auth_failed', message: error }.to_json)
        ws.close
        next
      end

      send_current_state(ws, session)
      redis_sub = subscribe_to_coverage_updates(ws, session_id)
    end

    ws.on :close do |_event|
      Rails.logger.debug("[CoverageWS] Assessor disconnected from session #{session_id}")
      # H4 fix: unsubscribe so the blocking Thread exits cleanly instead of
      # hanging forever waiting for the next message.
      Thread.new { redis_sub&.unsubscribe rescue nil }
    end

    ws.rack_response
  end

  def send_current_state(ws, session)
    session.reload
    maps       = session.coverage_maps.configured.order(:id)
    discovered = session.coverage_maps.discovered.order(:id)

    payload = {
      type:       'coverage_update',
      status:     session.status,
      end_reason: session.end_reason,
      skills:     maps.map { |m| coverage_json(m) },
      discovered: discovered.map { |m| coverage_json(m) }
    }

    ws.send(payload.to_json)
  rescue => e
    Rails.logger.error("[CoverageWS] Failed to send initial state: #{e.message}")
  end

  # Returns the Redis instance so the caller can unsubscribe on WS close.
  def subscribe_to_coverage_updates(ws, session_id)
    channel = "coverage:#{session_id}"
    redis = Redis.new(url: ENV.fetch('REDIS_URL', 'redis://localhost:6379/1'))

    Thread.new do
      redis.subscribe(channel) do |on|
        on.message do |_channel, message|
          EM.schedule do
            ws.send(message)
          rescue => e
            Rails.logger.debug("[CoverageWS] Failed to forward update: #{e.message}")
            redis.unsubscribe(channel)
          end
        end
      end
    rescue => e
      Rails.logger.error("[CoverageWS] Redis subscription error for #{channel}: #{e.message}")
    ensure
      redis.disconnect!
    end

    redis
  end

  def authenticate_assessor(env, session_id)
    auth_header = env['HTTP_AUTHORIZATION']
    return [nil, 'Missing authorization'] unless auth_header.present?

    authenticate_assessor_by_token(auth_header.split(' ').last, session_id)
  end

  def authenticate_assessor_by_token(token, session_id)
    payload = JsonWebToken.decode(token)

    org = Organization.find_by(scheme: payload[:scheme])
    return [nil, 'Invalid tenant'] unless org

    session = Session.unscoped.where(tenant_id: org.id).find_by(id: session_id)
    return [nil, 'Session not found'] unless session

    [session, nil]
  rescue => e
    [nil, "Authentication failed: #{e.message}"]
  end

  def coverage_json(map)
    {
      id:            map.id,
      skill_id:      map.skill_id,
      skill_label:   map.skill_label,
      is_discovered: map.is_discovered,
      state:         map.state,
      probe_count:   map.probe_count,
      last_signal:   map.last_signal
    }
  end
end
