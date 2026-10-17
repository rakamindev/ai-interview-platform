# frozen_string_literal: true

# Configure sensitive parameters which will be filtered from the log file.
# UU PDP (Undang-Undang Pelindungan Data Pribadi) compliance:
# Ensure personal identifying information, interview transcripts, and auth credentials
# are never written to server log files in cleartext.
Rails.application.config.filter_parameters += [
  :passw, :email, :secret, :token, :_key, :crypt, :salt, :certificate, :otp, :ssn,
  :candidate_name, :text, :transcript, :audio_data, :payload
]
