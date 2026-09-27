# frozen_string_literal: true

# Invite links are built from FRONTEND_BASE_URL; without it in production, candidates would get a dev-default link.
Rails.application.config.after_initialize do
  if Rails.env.production? && ENV['FRONTEND_BASE_URL'].blank?
    raise 'Missing required environment variable: FRONTEND_BASE_URL'
  end
end
