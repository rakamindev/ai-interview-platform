# frozen_string_literal: true

# Keep secrets and personal data out of the logs. Rails shows these params as
# [FILTERED]. A partial match counts, so :token also hides invite_token.
Rails.application.config.filter_parameters += %i[
  passw secret token _key crypt salt certificate otp ssn
  email candidate_name assessor_notes
]
