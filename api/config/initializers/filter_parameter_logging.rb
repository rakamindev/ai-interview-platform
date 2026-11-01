# frozen_string_literal: true

# Keeps credentials and personal data out of the request log.
Rails.application.config.filter_parameters += [
  :password,
  :email,
  :candidate_name,
  /\Ademo_request\.(name|company|message)\z/
]
