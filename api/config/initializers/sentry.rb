# frozen_string_literal: true

# Sentry error tracking. No-op unless SENTRY_DSN is present, so local dev and CI
# run clean without a Sentry project. When the DSN is set (via the k8s Secret or
# a deployed env), rails + sidekiq integrations activate and capture exceptions.
if ENV['SENTRY_DSN'].present?
  Sentry.init do |config|
    config.dsn = ENV['SENTRY_DSN']
    config.environment = ENV.fetch('RAILS_ENV', 'development')
    config.traces_sample_rate = 0.1
    config.breadcrumbs_logger = %i[active_support_logger http_logger]
  end
end
