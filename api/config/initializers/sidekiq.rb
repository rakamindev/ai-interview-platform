# frozen_string_literal: true

SIDEKIQ_STATUS_FILE = Rails.root.join('tmp/sidekiq_status').freeze

redis_url = ENV.fetch('REDIS_URI', 'redis://localhost:6379/0')

Sidekiq.configure_server do |config|
  config.redis = { url: redis_url }

  config.on(:startup) do
    FileUtils.mkdir_p(Rails.root.join('tmp'))
    File.write(SIDEKIQ_STATUS_FILE, "READY: 1\n")
  end

  config.on(:shutdown) do
    File.delete(SIDEKIQ_STATUS_FILE)
  rescue StandardError
    nil
  end
end

Sidekiq.configure_client do |config|
  config.redis = { url: redis_url }
end
