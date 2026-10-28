# frozen_string_literal: true

# Validate that WEB_BASE_URL is present at boot in production.
# Session#invite_url depends on it for every candidate invite link; a missing
# value previously fell back silently to this API's own URL (APP_BASE_URL),
# which has no /interview route and breaks every invite without any error.
Rails.application.config.after_initialize do
  if Rails.env.production? && ENV['WEB_BASE_URL'].blank?
    raise "Missing required environment variable: WEB_BASE_URL (the web app's base URL, used for candidate invite links)"
  end
end
