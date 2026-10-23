# frozen_string_literal: true

# Configure sensitive parameters which will be filtered from the log file.
# UU PDP Compliance: Ensure candidate personal identifiable information (PII)
# and credentials are never persisted in plaintext server logs.
Rails.application.config.filter_parameters += [
  :passw,
  :secret,
  :token,
  :_key,
  :crypt,
  :salt,
  :certificate,
  :otp,
  :ssn,
  :candidate_name,
  :email,
  :phone,
  :phone_number,
  :nik,
  :audio_data,
  :transcript,
  :evidence,
  :assessor_notes
]
