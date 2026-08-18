# frozen_string_literal: true

# Be sure to restart your server when you modify this file.

# Configure parameters to be filtered from the log file. Use this to limit dissemination of
# sensitive information, such as candidate PII under UU PDP (Indonesian Personal Data Protection Law).
Rails.application.config.filter_parameters += [
  :passw, :secret, :token, :_key, :crypt, :salt, :certificate, :otp, :ssn,
  :candidate_name, :email, :phone, :transcript, :audio_data
]
