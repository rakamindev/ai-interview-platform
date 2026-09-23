# frozen_string_literal: true

# Redact secrets and personal data from the parameter hash Rails would
# otherwise print. Matching is partial: :passw covers password.
# Restart the server after changing this file.
#
# SQL bind values are not covered here. Those lines are ActiveRecord debug
# logs, and they stay off unless RAILS_LOG_LEVEL=debug.
Rails.application.config.filter_parameters += %i[
  passw secret token _key crypt salt certificate otp ssn
  email authorization api_key access_token refresh_token
  candidate_name phone
]
