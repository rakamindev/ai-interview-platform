# frozen_string_literal: true

# Keep credentials and candidate personal data (UU PDP) out of Rails logs.
# `text` is anchored so it only matches transcript text, not keys like "context".
Rails.application.config.filter_parameters += [
  :password, :token, :secret, :api_key, :authorization, :jwt,
  :email, :candidate_name, /\Atext\z/
]
