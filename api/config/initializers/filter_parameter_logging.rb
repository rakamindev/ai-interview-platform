# frozen_string_literal: true

# Configure sensitive parameters which will be filtered from the log file.
# In compliance with Indonesian Personal Data Protection Law (UU PDP No. 27/2022),
# candidate personally identifiable information (PII), audio payloads, and tokens
# must be scrubbed from persistent application logs.

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
  :cvv,
  :cvc,
  :candidate_name,
  :invite_token,
  :email,
  :audio,
  :speech,
  :transcript,
  :authorization
]
