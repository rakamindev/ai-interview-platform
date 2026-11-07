# frozen_string_literal: true

require Rails.root.join('app/lib/configuration/web_base_url')

Rails.application.config.x.web_base_url = Configuration::WebBaseUrl.parse!(
  ENV['WEB_BASE_URL'],
  production: Rails.env.production?
)
