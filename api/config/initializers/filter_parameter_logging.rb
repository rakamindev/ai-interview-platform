# frozen_string_literal: true

# Be sure to restart your server when you modify this file.

# Configure parameters to be partially or fully filtered from the log file.
# AC-S3: Protect credentials, candidate PII, and sensitive assessment notes.
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
  :assessor_notes,
  :text
]
