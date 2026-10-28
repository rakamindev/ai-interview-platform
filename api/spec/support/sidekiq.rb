# frozen_string_literal: true

RSpec.configure do |config|
  # Jobs are pushed to an in-memory array instead of Redis.
  config.before do
    Sidekiq::Testing.fake!
    Sidekiq::Worker.clear_all
  end
end

RSpec.configure do |config|
  # Generation locks live in Redis, outside the example's database transaction.
  config.before do
    Sidekiq.redis do |redis|
      keys = redis.call('KEYS', 'fitgap:generating:*')
      redis.call('DEL', *keys) if keys.any?
    end
  end
end
