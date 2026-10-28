# frozen_string_literal: true

# Stands in for Gemini::HttpClient in specs. Pass it as `gemini_client:` to
# Portfolios::Generator or FitGap::Engine.
#
# Returns the canned response (Hash or String) or raises the given error, and
# records every call so specs can assert on what was sent.
class FakeGeminiClient
  attr_reader :calls

  def initialize(response = nil, error: nil)
    @response = response
    @error    = error
    @calls    = []
  end

  def generate_content(prompt, temperature: nil)
    @calls << { prompt: prompt, temperature: temperature }
    raise @error if @error

    @response
  end
end
