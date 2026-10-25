# frozen_string_literal: true

# Configure parameters to be filtered from the log file (UU PDP No. 27/2022 compliance).
Rails.application.config.filter_parameters += %i[
  passw secret token _key crypt salt certificate otp ssn
  candidate_name email password password_confirmation invite_token
]
