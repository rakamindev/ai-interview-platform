# frozen_string_literal: true

# Replaces every Gemini::HttpClient the app builds during a functional spec.
# The portfolio generator and the fit/gap engine each build their own client, so
# responses are picked by what the prompt asks for, not by call order.
#
#   gemini = stub_gemini(portfolio: { 'configured_skills' => [...] }, narrative: Gemini::HttpClient::TimeoutError)
#   gemini.prompts  # every prompt the app sent, in order
module ScriptedGemini
  PROMPT_KINDS = {
    portfolio: /structured skill portfolio/,
    narrative: /fit\/gap analysis narrative/
  }.freeze

  class Client
    attr_reader :prompts

    def initialize(responses)
      @responses = responses
      @prompts   = []
    end

    def generate_content(prompt, temperature: 0.2)
      kind = PROMPT_KINDS.find { |_, pattern| prompt.match?(pattern) }&.first
      raise "ScriptedGemini: no rule matches this prompt:\n#{prompt.lines.first(3).join}" unless kind
      raise "ScriptedGemini: no #{kind} response scripted" unless @responses.key?(kind)

      @prompts << { kind:, prompt:, temperature: }
      response = @responses.fetch(kind)
      raise response if response.is_a?(Exception) || (response.is_a?(Class) && response <= Exception)

      response.respond_to?(:deep_dup) ? response.deep_dup : response
    end
  end

  def stub_gemini(**responses)
    client = Client.new(responses)
    allow(Gemini::HttpClient).to receive(:new).and_return(client)
    client
  end
end

RSpec.configure do |config|
  config.include ScriptedGemini, type: :request
end
