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
    subscribed = false

    ws.on :open do |_event|
      # Try header-based auth first (assessor dashboard with JWT in header).
      # If no Authorization header is present, wait for a { type: "auth", token }
      # message — this matches the pattern used by the audio WS for browser clients
      # that can't set WebSocket headers.
      session, error = authenticate_assessor(env, session_id)
      next if error  # wait for auth message

      send_current_state(ws, session)
      subscribe_to_coverage_updates(ws, session, session_id)
      subscribed = true
    end

    ws.on :message do |event|
      next unless event.data.is_a?(String)

      message = JSON.parse(event.data) rescue next
      next unless message['type'] == 'auth'

      # Already authenticated via header — ignore
      next if subscribed

      token   = message['token'].to_s
      session, error = authenticate_assessor_by_token(token, session_id)

      if error
        ws.send({ type: 'error', code: 'auth_failed', message: error }.to_json)
        ws.close
        next
      end

      send_current_state(ws, session)
      subscribe_to_coverage_updates(ws, session, session_id)
      subscribed = true
    end

    ws.on :close do |_event|
      Rails.logger.debug("[CoverageWS] Assessor disconnected from session #{session_id}")
      CoveragePubsub.unregister(session_id, ws)
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

  # The session socket joins the process-wide fan-out; it no longer owns a Redis
  # connection or a thread, and a resubscribe after a Redis restart pushes the
  # current state back to it.
  def subscribe_to_coverage_updates(ws, session, session_id)
    CoveragePubsub.register(
      session_id,
      ws,
      on_resync: ->(socket) { send_current_state(socket, session) }
    )
  end

  def authenticate_assessor(env, session_id)
    auth_header = env['HTTP_AUTHORIZATION']
    return [nil, 'Missing authorization'] unless auth_header.present?

    authenticate_assessor_by_token(auth_header.split(' ').last, session_id)
  end

  def authenticate_assessor_by_token(token, session_id)
    payload = JsonWebToken.decode(token)

    unless AuthorizeApiRequest::ASSESSOR_ROLES.include?(payload[:role].to_s)
      return [nil, 'Unauthorized']
    end

    org = Organization.find_by(scheme: payload[:scheme])
    return [nil, 'Invalid tenant'] unless org

    session = Authorization::PortfolioAccess.find_session_for_websocket!(
      session_id,
      tenant_id: org.id
    )

    [session, nil]
  rescue ActiveRecord::RecordNotFound
    [nil, 'Session not found']
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
