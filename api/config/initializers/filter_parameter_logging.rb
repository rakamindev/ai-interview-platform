# frozen_string_literal: true

# Parameters matching these names are logged as [FILTERED] (partial match:
# :token also covers invite_token, :notes covers assessor_notes).
#
# Besides the Rails defaults, filter candidate personal data and assessor
# notes about candidates (UU PDP).
Rails.application.config.filter_parameters += %i[
  passw secret token _key crypt salt certificate otp ssn
  email candidate_name notes reason
]
