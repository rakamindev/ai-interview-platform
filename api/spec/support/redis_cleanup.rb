# These workers coordinate through hand-rolled Redis keys (locks, watermarks)
# rather than ActiveRecord, so they don't get cleaned up by transactional
# fixtures. Sweep the specific key patterns our workers own between examples
# instead of FLUSHDB, since this Redis instance is shared with local dev.
RSpec.configure do |config|
  config.after(:each) do
    Sidekiq.redis do |conn|
      %w[coverage_lock:* coverage_last_turn:* fitgap_lock:*].each do |pattern|
        keys = conn.keys(pattern)
        conn.del(*keys) if keys.any?
      end
    end
  end
end
