# frozen_string_literal: true

# Specs must never call the real model: it costs money, is slow, and is not deterministic.
# Services take a `gemini_client:` argument; pass a fake (see FakeGeminiClient) instead.
RSpec.configure do |config|
  config.before do
    allow(Gemini::HttpClient).to receive(:new)
      .and_raise('Real Gemini::HttpClient constructed in a spec; inject a fake gemini_client:')
  end
end

# Returns canned responses in order and records the prompts it received.
class FakeGeminiClient
  attr_reader :prompts

  def initialize(*responses)
    @responses = responses
    @prompts = []
  end

  def generate_content(prompt, temperature: nil)
    @prompts << prompt
    response = @responses.length > 1 ? @responses.shift : @responses.first
    raise response if response.is_a?(Exception)

    response
  end
end
