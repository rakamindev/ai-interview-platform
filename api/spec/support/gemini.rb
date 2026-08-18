# frozen_string_literal: true

# Every Gemini-calling service is dependency-injected with a `gemini_client:` keyword
# (defaulting to `Gemini::HttpClient.new(...)` from ENV). Specs must stub through that
# seam with `instance_double(Gemini::HttpClient)` — never hit the real API. WebMock's
# `disable_net_connect!` (spec/support/webmock.rb) is a guardrail behind this, not the
# primary stubbing mechanism: an unstubbed call should fail loudly here rather than
# reach WebMock and, worse, ever reach Google with candidate PII.
module GeminiHelpers
  def stub_gemini_client(response)
    instance_double(Gemini::HttpClient, generate_content: response)
  end
end

RSpec.configure do |config|
  config.include GeminiHelpers
end
