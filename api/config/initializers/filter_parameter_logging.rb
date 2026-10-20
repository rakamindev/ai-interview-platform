# frozen_string_literal: true

# Configure sensitive parameters which will be filtered from the log file.
# Protects passwords, secrets, and candidate PII in accordance with UU PDP No. 27/2022 Article 16 & 20.
Rails.application.config.filter_parameters += %i[
  passw secret token _key crypt salt certificate otp ssn
  candidate_name invite_token evidence prompt api_key
]
