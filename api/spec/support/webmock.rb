# frozen_string_literal: true

# Guardrail only, not the primary stubbing mechanism — see spec/support/gemini.rb.
# `allow_localhost: true` keeps Capybara/local server specs (if any land later) working.
WebMock.disable_net_connect!(allow_localhost: true)
