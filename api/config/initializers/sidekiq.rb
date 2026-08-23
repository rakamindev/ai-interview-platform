# frozen_string_literal: true

SIDEKIQ_STATUS_FILE = Rails.root.join('tmp/sidekiq_status').freeze

Sidekiq.configure_server do |config|
    config.redis = { url: ENV.fetch('REDIS_URL', 'redis://localhost:6379/1') }

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
    config.redis = { url: ENV.fetch('REDIS_URL', 'redis://localhost:6379/1') }
end
