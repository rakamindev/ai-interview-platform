# frozen_string_literal: true

# Stands in for Gemini::HttpClient so specs never touch the network.
# Pass a Hash/String to return it, or an exception (class or instance) to raise it.
class FakeGemini
  attr_reader :prompts

  def initialize(response)
    @response = response
    @prompts  = []
  end

  def generate_content(prompt, temperature: 0.2)
    @prompts << { prompt:, temperature: }
    raise @response if @response.is_a?(Exception) || (@response.is_a?(Class) && @response <= Exception)

    @response.respond_to?(:deep_dup) ? @response.deep_dup : @response
  end
end
