# frozen_string_literal: true

# Request parameters are logged at :info, the production log level. Mask credentials and
# personal data about candidates so they never reach the logs (UU PDP).
#
# Symbols match as substrings (:token also covers invite_token and the :token path param).
# `text` (transcript turns) is matched exactly so unrelated keys such as "context" stay readable.
Rails.application.config.filter_parameters += [
  :passw, :secret, :token, :_key, :crypt, :salt, :certificate, :otp,
  :email, :candidate_name, :assessor_notes, /\Atext\z/i
]
