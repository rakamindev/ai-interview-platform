# frozen_string_literal: true

RSpec.configure do |config|
  config.include FactoryBot::Syntax::Methods

  # Tenant scoping reads RequestStore; never leak a tenant between examples.
  config.after { RequestStore.clear! }
end

# Stand-in for Gemini::HttpClient so specs never touch the network.
# Pass `response:` to return it, or `error:` to raise it from generate_content.
class FakeGeminiClient
  attr_reader :prompts

  def initialize(response: nil, error: nil)
    @response = response
    @error    = error
    @prompts  = []
  end

  def generate_content(prompt, **)
    @prompts << prompt
    raise @error if @error

    @response
  end
end
