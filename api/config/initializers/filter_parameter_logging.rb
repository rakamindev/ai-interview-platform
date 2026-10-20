# frozen_string_literal: true

# Keys whose values are replaced with [FILTERED] in the request log (P1-7). Matching is by partial name, so
# :token also covers invite_token and auth_token.
#
# Rails' own defaults: credentials and identifiers.
# Ours: what an assessor writes about a candidate, and who the candidate is (UU PDP: personal data).
Rails.application.config.filter_parameters += %i[
  passw email secret token _key crypt salt certificate otp ssn cvv cvc
  assessor_notes candidate_name
]
