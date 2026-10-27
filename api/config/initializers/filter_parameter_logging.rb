# frozen_string_literal: true

# Configure parameters to be filtered from the log file.
# UU PDP Compliance (Undang-Undang Perlindungan Data Pribadi No. 27/2022):
# Ensure candidate personally identifiable information (PII), credentials,
# and sensitive tokens are masked from production and application logs.
Rails.application.config.filter_parameters += %i[
  passw secret token _key crypt salt certificate otp ssn nik
  candidate_name email phone candidate_email audio_pcm transcript
]
