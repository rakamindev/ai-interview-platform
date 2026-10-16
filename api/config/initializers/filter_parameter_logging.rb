# frozen_string_literal: true

# N05 fix: Filter sensitive parameters from Rails logs.
# Without this, passwords, tokens, and API keys appear in plain text in log output.
Rails.application.config.filter_parameters += %i[
  password
  token
  secret
  api_key
  gemini_api_key
  secret_key_base
  invite_token
]
