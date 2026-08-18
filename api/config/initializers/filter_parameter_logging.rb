# frozen_string_literal: true

# UU PDP (Indonesia Personal Data Protection) hygiene: never log credential/auth
# or personally-identifying parameters. Values matching these keys are scrubbed
# from Rails logs, e.g. POST bodies and error dumps.
Rails.application.config.filter_parameters += %i[
  passw secret token _key crypt salt otp ssn
  api_key invite_token candidate_name candidate_id
]