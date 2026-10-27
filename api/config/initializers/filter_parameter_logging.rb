# frozen_string_literal: true

# Configure parameters to be filtered from the log file to comply with
# Indonesia's Personal Data Protection Law (UU PDP No. 27/2022).
# Use this to limit dissemination of sensitive personal data and credentials.
Rails.application.config.filter_parameters += %i[
  passw secret token _key crypt salt certificate otp ssn
  invite_token candidate_name candidate_email audio transcript
]
