# frozen_string_literal: true

# UU PDP & Security: Configure sensitive parameters which will be filtered from the log file.
Rails.application.config.filter_parameters += [
  :passw, :secret, :token, :_key, :crypt, :salt, :certificate, :otp, :ssn,
  :audio, :pcm_bytes, :text, :transcription, :candidate_name, :gemini_resumption_token
]
