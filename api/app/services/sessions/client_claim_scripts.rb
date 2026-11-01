# frozen_string_literal: true

module Sessions
  # Lua scripts behind Sessions::ClientClaim. Each runs atomically on the interview's Redis hash.
  module ClientClaimScripts
    ADMIT = <<~LUA
      local key, client_id, token, ttl = KEYS[1], ARGV[1], ARGV[2], ARGV[3]
      if redis.call('HGET', key, 'closing') then return 'closing' end
      if client_id ~= '' then
        if redis.call('HEXISTS', key, 'revoked:' .. client_id) == 1 then return 'taken' end
        local owner = redis.call('HGET', key, 'owner')
        if owner and owner ~= client_id then return 'taken' end
        redis.call('HSET', key, 'owner', client_id)
      end
      redis.call('HSET', key, 'connection', token)
      redis.call('HDEL', key, 'deadline')
      redis.call('EXPIRE', key, ttl)
      return token
    LUA

    # A repeated reset_id is the same assessor action retried, so it must not cut off a candidate who
    # rejoined meanwhile. A reset with no owner left is a deliberate second try, so it also lifts earlier
    # revocations. The deadline never moves: an expired Gemini session cannot be resumed anyway.
    RESET = <<~LUA
      local key, reset_id, token, deadline, ttl = KEYS[1], ARGV[1], ARGV[2], ARGV[3], ARGV[4]
      if redis.call('HGET', key, 'closing') then return {} end
      if redis.call('HGET', key, 'last_reset') == reset_id then
        return { redis.call('HGET', key, 'last_reset_connection'), redis.call('HGET', key, 'last_reset_deadline') }
      end
      if not redis.call('HGET', key, 'connection') then return {} end
      local owner = redis.call('HGET', key, 'owner')
      if owner then
        redis.call('HSET', key, 'revoked:' .. owner, '1')
        redis.call('HDEL', key, 'owner')
      else
        local fields = redis.call('HKEYS', key)
        for _, field in ipairs(fields) do
          if string.sub(field, 1, 8) == 'revoked:' then redis.call('HDEL', key, field) end
        end
      end
      deadline = redis.call('HGET', key, 'deadline') or deadline
      redis.call('HSET', key, 'connection', token, 'deadline', deadline, 'last_reset', reset_id,
                 'last_reset_connection', token, 'last_reset_deadline', deadline)
      redis.call('EXPIRE', key, ttl)
      return { token, deadline }
    LUA

    DISCONNECT = <<~LUA
      local key, token, deadline = KEYS[1], ARGV[1], ARGV[2]
      if redis.call('HGET', key, 'connection') ~= token then return false end
      redis.call('HSET', key, 'deadline', deadline)
      return deadline
    LUA

    FINALIZE = <<~LUA
      local key, token = KEYS[1], ARGV[1]
      if redis.call('HGET', key, 'connection') ~= token then return 0 end
      redis.call('HSET', key, 'closing', '1')
      return 1
    LUA
  end
end
