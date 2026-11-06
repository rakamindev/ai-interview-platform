# frozen_string_literal: true

# W25: candidate invite links must open the web app's /interview/:token page, not the API.
# WEB_APP_URL is the public address of the web app (for example https://interview.example.com).
#
# Development and test fall back to the local Vite server. Every other environment must set it:
# a missing or malformed value stops boot with a clear message, so a misconfiguration is caught at
# deploy time instead of as broken links sent to real candidates.
module WebAppUrl
  LOCAL_DEFAULT = 'http://localhost:5173'

  def self.resolve(raw, env)
    value = raw.to_s.strip
    if value.empty?
      return LOCAL_DEFAULT if env.development? || env.test?

      raise ArgumentError, 'WEB_APP_URL is not set. Set it to the public URL of the web app ' \
                           '(candidate invite links are built from it).'
    end

    uri = URI.parse(value)
    raise URI::InvalidURIError unless uri.is_a?(URI::HTTP) && uri.host.present?

    value.delete_suffix('/')
  rescue URI::InvalidURIError
    raise ArgumentError, "WEB_APP_URL must be an http(s) URL, got #{value.inspect}."
  end
end

Rails.application.config.x.web_app_url = WebAppUrl.resolve(ENV['WEB_APP_URL'], Rails.env)
