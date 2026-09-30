Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    # Logika untuk membaca environment variable
    if ENV['ALLOWED_ORIGINS'] == '*'
      origins '*'
    else
      # Fallback ke split koma jika tidak menggunakan '*'
      origins ENV.fetch('ALLOWED_ORIGINS', '').split(',')
    end

    resource '*',
      headers: :any,
      methods: [:get, :post, :put, :patch, :delete, :options, :head],
      # expose: ['access-token', 'expiry', 'token-type', 'uid', 'client'], # Buka komentar ini jika Anda pakai Devise Token Auth
      credentials: false # Harus false jika origin adalah '*'
  end
end
