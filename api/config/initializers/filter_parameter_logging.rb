# frozen_string_literal: true

# Be sure to restart your server when you modify this file.

# Configure parameters to be partially or completely matched and filtered from the log file.
# UU PDP (Undang-Undang Perlindungan Data Pribadi No. 27/2022) compliant parameter filtering.
Rails.application.config.filter_parameters += [
  :passw, :secret, :token, :_key, :crypt, :salt, :certificate, :otp, :ssn,
  :candidate_name, :email, :audio, :transcript, :evidence
]
