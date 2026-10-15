# frozen_string_literal: true

# Stands in for Gemini::HttpClient. Returns the given responses in order
# (repeating the last one); an Exception instance is raised instead.
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

  def calls = @prompts.size
end
