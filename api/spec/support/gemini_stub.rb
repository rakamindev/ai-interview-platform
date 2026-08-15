# frozen_string_literal: true

# Every AI-dependent service takes an injectable `gemini_client:`. These helpers
# make the injection ergonomic so specs describe model *behaviour* — including
# hostile behaviour — rather than mocking HTTP.
module GeminiStubHelpers
  def stub_gemini(mode = :happy, payload: nil)
    Gemini::StubClient.new(mode: mode, payload: payload)
  end
end

RSpec.configure do |config|
  config.include GeminiStubHelpers
end
