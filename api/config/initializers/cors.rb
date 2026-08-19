# frozen_string_literal: true

Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    allowed_origins = ENV.fetch('ALLOWED_ORIGINS') do
      raise KeyError, 'key not found: "ALLOWED_ORIGINS"' if Rails.env.production?

      'http://localhost:5173,http://127.0.0.1:5173'
    end

    origins allowed_origins.split(',').map(&:strip).reject(&:empty?)
    resource '*',
             headers: :any,
             methods: %i[get post put patch delete options head],
             expose: ['Authorization'],
             credentials: false
  end
end
