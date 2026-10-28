# frozen_string_literal: true

# Stands in for Gemini::HttpClient. Returns a canned payload (or raises) and
# records the prompts it was given.
class ScriptedModel
  attr_reader :prompts

  def initialize(response = nil, raises: nil)
    @response = response
    @raises   = raises
    @prompts  = []
  end

  def generate_content(prompt, temperature: nil) # rubocop:disable Lint/UnusedMethodArgument
    @prompts << prompt
    raise @raises if @raises

    @response.respond_to?(:call) ? @response.call : @response
  end
end
