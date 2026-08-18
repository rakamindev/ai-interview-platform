# frozen_string_literal: true

# Rails generates this file with every new application; this repository never
# had it, so `config.filter_parameters` was empty. ActionController logs the
# parameter hash at INFO (log_subscriber.rb: `return unless logger.info?`) and
# production runs at INFO, which means every sign-in wrote the submitted
# password to the application log in plain text.
#
# The first list is the framework default, restored verbatim. Matching is by
# substring, so `:passw` covers `password`, and `:token` covers both the
# `:token` path segment on the candidate routes and any `invite_token` in a
# body — the invite token is a session credential in its own right (it alone
# authorises `POST /sessions/:token/audio_complete`).
#
# `:email` is this application's addition. Under UU PDP an email address is
# personal data, and the people it identifies here include candidates, who did
# not choose this product and cannot ask us what we logged about them.
#
# Known gap: this filters the parameter hash, not the request line. Rails
# filters only the query string of `filtered_path`, so an invite token sitting
# in a path segment still reaches the log through
# `Started POST /api/v1/sessions/<token>/consent`. Closing that means moving
# the token out of the URL — a routing change with a migration for live invite
# links, recorded as a follow-up rather than smuggled in here.
Rails.application.config.filter_parameters += %i[
  passw secret token _key crypt salt certificate otp ssn
  email
]
