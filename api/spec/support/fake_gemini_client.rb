# frozen_string_literal: true

# Stand-in for Gemini::HttpClient. Services accept it through their `gemini_client:` argument.
#
#   FakeGeminiClient.new(response: { 'configured_skills' => [...] })
#   FakeGeminiClient.new(error: Gemini::HttpClient::RateLimitError.new('Rate limited'))
class FakeGeminiClient
  attr_reader :prompts

  def initialize(response: nil, error: nil)
    @response = response
    @error    = error
    @prompts  = []
  end

  def generate_content(prompt, temperature: 0.2)
    @prompts << { prompt: prompt, temperature: temperature }
    raise @error if @error

    @response
  end

  def called?
    @prompts.any?
  end
end
