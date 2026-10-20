# frozen_string_literal: true

require 'faye/websocket'
require 'monitor'

# Rack middleware for assessor live coverage monitoring at /ws/sessions/:id/coverage.
# Server-push only: subscribes to Redis pub/sub and forwards coverage updates to the assessor.
class CoverageWebSocketMiddleware
  COVERAGE_PATH_PATTERN = %r{\A/ws/sessions/([^/]+)/coverage\z}

  @lock = Monitor.new
  @channels = {}

  class << self
    def channels
      @channels
    end

    def subscribe(channel, ws)
      @lock.synchronize do
        entry = @channels[channel] ||= { sockets: Set.new, redis: nil, thread: nil }
        entry[:sockets].add(ws)

        if entry[:thread].nil? || !entry[:thread].alive?
          redis = Redis.new(url: ENV.fetch('REDIS_URL', 'redis://localhost:6379/1'))
          entry[:redis] = redis

          entry[:thread] = Thread.new do
            redis.subscribe(channel) do |on|
              on.message do |_ch, message|
                sockets = @lock.synchronize { entry[:sockets].dup }
                sockets.each do |socket|
                  EM.schedule do
                    socket.send(message)
                  rescue StandardError => e
                    Rails.logger.debug("[CoverageWS] Failed to forward update: #{e.message}")
                  end
                end
              end
            end
          rescue StandardError => e
            Rails.logger.error("[CoverageWS] Redis subscription error for #{channel}: #{e.message}")
          ensure
            redis.disconnect! rescue nil
          end
        end
      end
    end

    def unsubscribe(channel, ws)
      @lock.synchronize do
        entry = @channels[channel]
        return unless entry

        entry[:sockets].delete(ws)
        if entry[:sockets].empty?
          redis = entry[:redis]
          entry[:redis] = nil
          entry[:thread] = nil
          @channels.delete(channel)

          cleanup_thread = Thread.new do
            redis&.unsubscribe(channel) rescue nil
            redis&.disconnect! rescue nil
          end
          cleanup_thread.join if Rails.env.test?
        end
      end
    end

    def reset_channels!
      @lock.synchronize do
        @channels.each_value do |entry|
          entry[:redis]&.disconnect! rescue nil
          entry[:thread]&.kill rescue nil
        end
        @channels.clear
      end
    end
  end

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
    channel = "coverage:#{session_id}"
    subscribed = false

    ws.on :open do |_event|
      session, error = authenticate_assessor(env, session_id)
      next if error

      send_current_state(ws, session)
      CoverageWebSocketMiddleware.subscribe(channel, ws)
      subscribed = true
    end

    ws.on :message do |event|
      next unless event.data.is_a?(String)

      message = JSON.parse(event.data) rescue next
      next unless message['type'] == 'auth'

      next if subscribed

      token   = message['token'].to_s
      session, error = authenticate_assessor_by_token(token, session_id)

      if error
        ws.send({ type: 'error', code: 'auth_failed', message: error }.to_json)
        ws.close
        next
      end

      send_current_state(ws, session)
      CoverageWebSocketMiddleware.subscribe(channel, ws)
      subscribed = true
    end

    ws.on :close do |_event|
      Rails.logger.debug("[CoverageWS] Assessor disconnected from session #{session_id}")
      if subscribed
        CoverageWebSocketMiddleware.unsubscribe(channel, ws)
        subscribed = false
      end
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
