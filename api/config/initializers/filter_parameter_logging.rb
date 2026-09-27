# frozen_string_literal: true

# Keep credentials and candidate personal data out of request logs (UU PDP data minimisation).
# Matching is partial: :token also covers invite_token, :passw covers password.
Rails.application.config.filter_parameters += %i[
  passw secret token _key crypt salt certificate otp ssn
  email candidate_name assessor_notes
]
