# frozen_string_literal: true

require 'net/http'

Rails.application.config.after_initialize do
  next if Rails.env.test?
  Thread.new do
    begin
      key = ENV['GEMINI_API_KEY']
      next unless key.present?

      %w[GEMINI_FLASH_MODEL GEMINI_PRO_MODEL].each do |env_key|
        model = ENV[env_key]
        next unless model.present?

        uri = URI("https://generativelanguage.googleapis.com/v1/models/#{model}?key=#{key}")
        res = Net::HTTP.get_response(uri)
        unless res.is_a?(Net::HTTPSuccess)
          Rails.logger.warn("[BootCheck] #{env_key}=#{model} returned #{res.code} on startup")
        end
      end
    rescue => e
      Rails.logger.warn("[BootCheck] model probe failed: #{e.class} #{e.message}")
    end
  end
end