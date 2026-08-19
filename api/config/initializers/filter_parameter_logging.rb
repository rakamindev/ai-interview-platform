# frozen_string_literal: true

Rails.application.config.filter_parameters += %i[
  passw password password_confirmation
  secret token _key crypt salt certificate otp ssn
  authorization api_key access_token refresh_token
]
