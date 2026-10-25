# frozen_string_literal: true

require 'json'
require 'securerandom'

module Sessions
  # Redis-backed, cross-process ownership for a candidate interview connection.
  # Every mutation is a Lua compare-and-set so a stale Puma worker can never
  # reclaim, refresh, disconnect, or allocate turns for a newer generation.
  class ConnectionLease
    ACTIVE_TTL_SECONDS = ENV.fetch('INTERVIEW_LEASE_TTL_SECONDS', 45).to_i
    GRACE_TTL_SECONDS = ENV.fetch('INTERVIEW_GRACE_TTL_SECONDS', 150).to_i
    HEARTBEAT_INTERVAL_SECONDS = ENV.fetch('INTERVIEW_LEASE_HEARTBEAT_SECONDS', 15).to_i

    Result = Struct.new(:status, :generation, :owner_connection_id, keyword_init: true) do
      def acquired? = status.in?(%i[acquired resumed taken_over])
    end

    class Unavailable < StandardError; end

    ACQUIRE_SCRIPT = <<~LUA
      local key = KEYS[1]
      local channel = KEYS[2]
      local connection_id = ARGV[1]
      local now_ms = ARGV[2]
      local ttl = tonumber(ARGV[3])
      local initial_turn = tonumber(ARGV[4])

      if redis.call('EXISTS', key) == 0 then
        redis.call('HSET', key,
          'connection_id', connection_id,
          'generation', 1,
          'state', 'connected',
          'updated_at_ms', now_ms,
          'turn_counter', initial_turn)
        redis.call('EXPIRE', key, ttl)
        return {'acquired', '1', connection_id}
      end

      local current_state = redis.call('HGET', key, 'state')
      local current_connection = redis.call('HGET', key, 'connection_id')
      local current_generation = tonumber(redis.call('HGET', key, 'generation') or '0')

      if current_state == 'disconnected_grace' then
        local next_generation = current_generation + 1
        local current_turn = tonumber(redis.call('HGET', key, 'turn_counter') or '0')
        if initial_turn > current_turn then current_turn = initial_turn end
        redis.call('HSET', key,
          'connection_id', connection_id,
          'generation', next_generation,
          'state', 'connected',
          'updated_at_ms', now_ms,
          'turn_counter', current_turn)
        redis.call('HDEL', key, 'disconnected_at_ms')
        redis.call('EXPIRE', key, ttl)
        redis.call('PUBLISH', channel, cjson.encode({
          type = 'connection_replaced',
          previous_connection_id = current_connection,
          previous_generation = current_generation,
          generation = next_generation
        }))
        return {'resumed', tostring(next_generation), connection_id}
      end

      return {'in_use', tostring(current_generation), current_connection}
    LUA

    TAKEOVER_SCRIPT = <<~LUA
      local key = KEYS[1]
      local channel = KEYS[2]
      local connection_id = ARGV[1]
      local now_ms = ARGV[2]
      local ttl = tonumber(ARGV[3])
      local initial_turn = tonumber(ARGV[4])
      local expected_generation = tonumber(ARGV[5])
      local expected_owner = ARGV[6]

      local current_generation = tonumber(redis.call('HGET', key, 'generation') or '0')
      local current_connection = redis.call('HGET', key, 'connection_id')
      if redis.call('EXISTS', key) == 1 and
         (current_generation ~= expected_generation or current_connection ~= expected_owner) then
        return {'in_use', tostring(current_generation), current_connection}
      end
      local current_turn = tonumber(redis.call('HGET', key, 'turn_counter') or '0')
      if initial_turn > current_turn then current_turn = initial_turn end
      local next_generation = current_generation + 1

      redis.call('HSET', key,
        'connection_id', connection_id,
        'generation', next_generation,
        'state', 'connected',
        'updated_at_ms', now_ms,
        'turn_counter', current_turn)
      redis.call('HDEL', key, 'disconnected_at_ms')
      redis.call('EXPIRE', key, ttl)
      redis.call('PUBLISH', channel, cjson.encode({
        type = 'connection_replaced',
        previous_connection_id = current_connection,
        previous_generation = current_generation,
        generation = next_generation
      }))

      return {'taken_over', tostring(next_generation), connection_id}
    LUA

    HEARTBEAT_SCRIPT = <<~LUA
      if redis.call('HGET', KEYS[1], 'connection_id') ~= ARGV[1] then return 0 end
      if redis.call('HGET', KEYS[1], 'generation') ~= ARGV[2] then return 0 end
      if redis.call('HGET', KEYS[1], 'state') ~= 'connected' then return 0 end
      redis.call('HSET', KEYS[1], 'updated_at_ms', ARGV[3])
      redis.call('EXPIRE', KEYS[1], tonumber(ARGV[4]))
      return 1
    LUA

    DISCONNECT_SCRIPT = <<~LUA
      if redis.call('HGET', KEYS[1], 'connection_id') ~= ARGV[1] then return 0 end
      if redis.call('HGET', KEYS[1], 'generation') ~= ARGV[2] then return 0 end
      if redis.call('HGET', KEYS[1], 'state') ~= 'connected' then return 0 end
      redis.call('HSET', KEYS[1],
        'state', 'disconnected_grace',
        'disconnected_at_ms', ARGV[3],
        'updated_at_ms', ARGV[3])
      redis.call('EXPIRE', KEYS[1], tonumber(ARGV[4]))
      return 1
    LUA

    NEXT_TURN_SCRIPT = <<~LUA
      if redis.call('HGET', KEYS[1], 'connection_id') ~= ARGV[1] then return 0 end
      if redis.call('HGET', KEYS[1], 'generation') ~= ARGV[2] then return 0 end
      if redis.call('HGET', KEYS[1], 'state') ~= 'connected' then return 0 end
      return redis.call('HINCRBY', KEYS[1], 'turn_counter', 1)
    LUA

    RELEASE_SCRIPT = <<~LUA
      if redis.call('HGET', KEYS[1], 'connection_id') ~= ARGV[1] then return 0 end
      if redis.call('HGET', KEYS[1], 'generation') ~= ARGV[2] then return 0 end
      return redis.call('DEL', KEYS[1])
    LUA

    TERMINATE_SCRIPT = <<~LUA
      redis.call('DEL', KEYS[1])
      redis.call('PUBLISH', KEYS[2], cjson.encode({type = 'session_terminal'}))
      return 1
    LUA

    def initialize(session_id, redis_factory: nil)
      @session_id = session_id
      @redis_factory = redis_factory || -> { ::Redis.new(url: ENV.fetch('REDIS_URL', 'redis://localhost:6379/1')) }
    end

    def acquire(connection_id:, initial_turn:)
      values = with_redis do |redis|
        redis.eval(
          ACQUIRE_SCRIPT,
          keys: [key, channel],
          argv: [connection_id, now_ms, ACTIVE_TTL_SECONDS, initial_turn]
        )
      end
      build_result(values)
    end

    def takeover(connection_id:, initial_turn:, expected_generation:, expected_owner_connection_id:)
      values = with_redis do |redis|
        redis.eval(
          TAKEOVER_SCRIPT,
          keys: [key, channel],
          argv: [
            connection_id,
            now_ms,
            ACTIVE_TTL_SECONDS,
            initial_turn,
            expected_generation,
            expected_owner_connection_id
          ]
        )
      end
      build_result(values)
    end

    def heartbeat(connection_id:, generation:)
      compare_and_set(HEARTBEAT_SCRIPT, connection_id, generation, now_ms, ACTIVE_TTL_SECONDS)
    end

    def disconnect(connection_id:, generation:)
      compare_and_set(DISCONNECT_SCRIPT, connection_id, generation, now_ms, GRACE_TTL_SECONDS)
    end

    def authoritative?(connection_id:, generation:, state: 'connected')
      values = with_redis { |redis| redis.hmget(key, 'connection_id', 'generation', 'state') }
      values == [connection_id, generation.to_s, state]
    end

    def next_turn(connection_id:, generation:)
      value = with_redis do |redis|
        redis.eval(NEXT_TURN_SCRIPT, keys: [key], argv: [connection_id, generation])
      end
      value.to_i.positive? ? value.to_i : nil
    end

    def release(connection_id:, generation:)
      compare_and_set(RELEASE_SCRIPT, connection_id, generation)
    end

    def terminate!
      with_redis { |redis| redis.eval(TERMINATE_SCRIPT, keys: [key, channel], argv: []) }
      true
    end

    def subscribe(&block)
      Subscription.new(@redis_factory.call, channel, &block).tap(&:start)
    rescue StandardError => e
      raise Unavailable, "Redis subscription unavailable: #{e.message}"
    end

    def delete!
      with_redis { |redis| redis.del(key) }
    end

    private

    def build_result(values)
      Result.new(
        status: values.fetch(0).to_sym,
        generation: values.fetch(1).to_i,
        owner_connection_id: values[2]
      )
    end

    def compare_and_set(script, *argv)
      with_redis { |redis| redis.eval(script, keys: [key], argv: argv) }.to_i == 1
    end

    def with_redis
      redis = @redis_factory.call
      yield redis
    rescue StandardError => e
      raise Unavailable, "Redis lease unavailable: #{e.message}"
    ensure
      redis&.close
    end

    def key
      "interview:#{Rails.env}:session:#{@session_id}:connection"
    end

    def channel
      "interview:#{Rails.env}:session:#{@session_id}:control"
    end

    def now_ms
      (Time.current.to_f * 1000).to_i
    end

    # A dedicated Redis subscription is deliberately isolated from command
    # connections. Closing it unblocks `subscribe` during WebSocket cleanup.
    class Subscription
      def initialize(redis, channel, &callback)
        @redis = redis
        @channel = channel
        @callback = callback
      end

      def start
        @thread = Thread.new do
          @redis.subscribe(@channel) do |on|
            on.message do |_channel, raw|
              @callback.call(JSON.parse(raw))
            rescue JSON::ParserError => e
              Rails.logger.warn("[ConnectionLease] Invalid control payload: #{e.message}")
            end
          end
        rescue IOError, Redis::BaseError => e
          Rails.logger.warn("[ConnectionLease] Subscription stopped: #{e.message}")
        end
      end

      def stop
        @redis.close
        @thread&.join(0.2)
        @thread&.kill if @thread&.alive?
      rescue IOError, Redis::BaseError
        nil
      end
    end
  end
end
