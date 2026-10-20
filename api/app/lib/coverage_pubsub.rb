# frozen_string_literal: true

require 'connection_pool'

# One Redis subscriber per process fans coverage updates out to every registered
# monitor socket.
#
# Each assessor monitor socket used to open its own Redis connection plus two
# threads (one parked in SUBSCRIBE, one only to unsubscribe on close), so the
# Redis client count grew with the number of open dashboards and every socket
# held a blocked client. Here the subscription is shared: one pooled connection
# per process, a registry of sockets per session, and a supervisor thread that
# reconnects with bounded backoff and resyncs every socket after resubscribing.
module CoveragePubsub
  CHANNEL_PATTERN = 'coverage:*'
  BACKOFF = [0.5, 1, 2, 5].freeze
  STOP_TIMEOUT = 5

  Entry = Struct.new(:ws, :on_resync)

  class << self
    # Adds a socket to the fan-out. `on_resync` is called with the socket after a
    # (re)subscribe so a monitoring assessor gets the current state immediately
    # instead of waiting for the next coverage update.
    def register(session_id, ws, on_resync: nil)
      mutex.synchronize do
        entries = registry[session_id.to_s] ||= []
        entries << Entry.new(ws, on_resync) unless entries.any? { |entry| entry.ws.equal?(ws) }
        start_supervisor
      end

      nil
    end

    def unregister(session_id, ws)
      empty = false

      mutex.synchronize do
        key     = session_id.to_s
        entries = registry[key]

        if entries
          entries.reject! { |entry| entry.ws.equal?(ws) }
          registry.delete(key) if entries.empty?
        end

        empty = registry.empty?
      end

      stop_supervisor if empty
      nil
    end

    def registered?(session_id, ws)
      mutex.synchronize do
        (registry[session_id.to_s] || []).any? { |entry| entry.ws.equal?(ws) }
      end
    end

    # Number of sockets currently fanned out to. Used by verification.
    def socket_count
      mutex.synchronize { registry.values.sum(&:size) }
    end

    def running?
      mutex.synchronize { @supervisor&.alive? || false }
    end

    def reset!
      stop_supervisor

      mutex.synchronize do
        registry.clear
        @stopping = false
      end
    end

    private

    def mutex
      @mutex ||= Mutex.new
    end

    def registry
      @registry ||= {}
    end

    def stopping?
      mutex.synchronize { @stopping }
    end

    def start_supervisor
      return if @supervisor&.alive?

      @stopping   = false
      @supervisor = Thread.new { supervise }
    end

    def stop_supervisor
      supervisor = mutex.synchronize do
        @stopping = true
        @supervisor
      end
      return unless supervisor

      unsubscribe_current
      supervisor.join(STOP_TIMEOUT)
      supervisor.kill if supervisor.alive?

      mutex.synchronize { @supervisor = nil if @supervisor.equal?(supervisor) }
    end

    def supervise
      attempt = 0

      until stopping?
        begin
          connection = pool.checkout
          set_current_connection(connection)

          connection.psubscribe(CHANNEL_PATTERN) do |on|
            on.psubscribe do |_pattern, _count|
              attempt = 0
              resync_all
            end

            on.pmessage do |_pattern, channel, payload|
              dispatch(channel, payload)
            end
          end
        rescue StandardError => e
          Rails.logger.warn("[CoveragePubsub] subscriber connection error: #{e.class}")
        ensure
          release_current_connection
        end

        break if stopping?

        sleep(BACKOFF[[attempt, BACKOFF.size - 1].min])
        attempt += 1
      end
    end

    def pool
      @pool ||= mutex.synchronize do
        @pool ||= ConnectionPool.new(size: 1, timeout: STOP_TIMEOUT) do
          Redis.new(
            url:                ENV.fetch('REDIS_URL', 'redis://localhost:6379/1'),
            timeout:            5,
            reconnect_attempts: 1
          )
        end
      end
    end

    def set_current_connection(connection)
      @current_connection = connection
    end

    def current_connection
      @current_connection
    end

    def release_current_connection
      connection = current_connection
      return unless connection

      @current_connection = nil
      pool.checkin(connection)
    rescue StandardError => e
      Rails.logger.debug("[CoveragePubsub] failed to release the subscriber connection: #{e.class}")
    end

    # Unblocks the subscribe call so the supervisor thread can exit.
    def unsubscribe_current
      connection = current_connection
      return unless connection

      connection.punsubscribe
    rescue StandardError => e
      Rails.logger.debug("[CoveragePubsub] unsubscribe failed: #{e.class}")
    end

    def dispatch(channel, payload)
      session_id = channel.to_s.split(':', 2).last.to_s
      entries    = mutex.synchronize { (registry[session_id] || []).dup }
      return if entries.empty?

      entries.each { |entry| deliver(session_id, entry, payload) }
    end

    def deliver(session_id, entry, payload)
      send_now = lambda do
        entry.ws.send(payload)
      rescue StandardError => e
        Rails.logger.debug("[CoveragePubsub] failed to forward an update: #{e.class}")
        unregister(session_id, entry.ws)
      end

      schedule { send_now.call }
    end

    def resync_all
      entries = mutex.synchronize { registry.values.flatten.dup }

      entries.each do |entry|
        next unless entry.on_resync

        schedule do
          entry.on_resync.call(entry.ws)
        rescue StandardError => e
          Rails.logger.debug("[CoveragePubsub] resync failed: #{e.class}")
        end
      end
    end

    def schedule(&block)
      if event_machine_running?
        EM.schedule(&block)
      else
        block.call
      end
    end

    def event_machine_running?
      defined?(EM) && EM.respond_to?(:reactor_running?) && EM.reactor_running?
    end
  end
end
