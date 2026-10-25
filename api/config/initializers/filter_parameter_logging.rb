# frozen_string_literal: true

# Administrator invitation tokens are bearer credentials. Keep them out of
# request logs while still allowing the public validation and redemption
# endpoints to receive them in JSON request bodies.
Rails.application.config.filter_parameters += %i[
  invitation
  invitation_token
  password
  password_confirmation
  token_digest
]
