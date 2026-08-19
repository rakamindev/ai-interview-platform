# frozen_string_literal: true

# Be sure to restart your server when you modify this file.

# Configure parameters to be partially matched (e.g. passw matches password) and
# filtered from the log file. Use this to limit dissemination of sensitive
# information. See the ActiveSupport::ParameterFilter documentation for supported
# notations and behaviors.
#
# This was previously empty (config.filter_parameters is [] by default) — every
# request to POST /api/v1/auth/login logged raw plaintext passwords. CV screening
# adds candidate emails and multipart file uploads to the mix, so this fixes a
# pre-existing defect rather than being purely new-feature hygiene.
Rails.application.config.filter_parameters += %i[
  passw email token secret cv file resume
]
