# frozen_string_literal: true

module Gemini
  # Fixture-backed double for Gemini::HttpClient. Same interface (initialize +
  # #generate_content), so every service that accepts `gemini_client:` can be
  # pointed at it without change.
  #
  # Modes (see spec/fixtures/gemini/*.json):
  #   :valid, :missing_level, :out_of_range_level, :string_level,
  #   :missing_confidence, :bad_confidence_enum, :missing_summary,
  #   :empty_arrays, :malformed_json, :injected_instructions
  #
  # :timeout and :rate_limited raise the matching HttpClient error class, so
  # the failure paths the acceptance criteria require are per-call injectable.
  class StubClient
    RAISING_MODES = {
      timeout:       HttpClient::TimeoutError,
      rate_limited:  HttpClient::RateLimitError
    }.freeze

    FIXTURE_MODES = %i[
      valid missing_level out_of_range_level string_level
      missing_confidence bad_confidence_enum missing_summary
      empty_arrays malformed_json injected_instructions
    ].freeze

    def initialize(model: nil, mode: nil, api_key: nil, timeout: 60)
      @model = model
      @mode = (mode || ENV.fetch('GEMINI_STUB_MODE', 'valid')).to_sym
      @timeout = timeout
      @fixture_dir = ENV['GEMINI_FIXTURE_DIR'] || File.expand_path('../../../spec/fixtures/gemini', __dir__)
    end

    # Mirrors HttpClient#generate_content: returns a parsed Hash, or a String
    # when the fixture is not valid JSON (the malformed-json case).
    def generate_content(_prompt, temperature: 0.2)
      raise RAISING_MODES.fetch(@mode).new("stubbed #{@mode}", status: 429, body: 'stub response') if RAISING_MODES.key?(@mode)

      raw = File.read(File.join(@fixture_dir, "#{@mode}.json"))
      JSON.parse(raw)
    rescue JSON::ParserError
      raw
    end
  end
end
