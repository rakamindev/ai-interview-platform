# frozen_string_literal: true

module Ai
  # Thin, isolated boundary between the application and the Gemini model for
  # evaluation work. Isolating the model behind one interface makes the
  # pipeline deterministic and testable (Gemini can be stubbed in specs).
  #
  # Failure policy (from the evidence-backed evaluation thesis):
  #   * Timeout / model error  -> raises; caller persists `failed` (never `score = 0`)
  #   * Malformed output       -> raises; caller persists `needs_review`
  #   * Retry                  -> only transient failures, never deterministic ones
  class InterviewEvaluatorService
    def initialize(gemini_client: nil)
      @gemini_client = gemini_client || Gemini::HttpClient.new(
        model:   ENV.fetch('GEMINI_PRO_MODEL', 'gemini-2.0-pro-001'),
        timeout: 180
      )
      @scrubber = PiiScrubber.new
    end

    # Builds a prompt from raw material, scrubs PII, and calls the model.
    # Returns parsed structured JSON.
    def analyze(prompt)
      safe_prompt = @scrubber.scrub(prompt)
      response    = @gemini_client.generate_content(safe_prompt, temperature: 0.2)

      parse_structured(response)
    rescue Gemini::HttpClient::TimeoutError => e
      raise EvaluationTimeoutError, "Evaluation timed out: #{e.message}"
    rescue Gemini::HttpClient::ApiError => e
      raise EvaluationFailureError, "Evaluation model error: #{e.message}"
    end

    # Interprets a raw Gemini response as structured JSON with strict shape.
    # Raises MalformedEvaluationError if it cannot be trusted.
    def parse_structured(response)
      data = response.is_a?(Hash) ? response : JSON.parse(response.to_s)
      data = data.deep_symbolize_keys if data.is_a?(Hash)

      unless data.is_a?(Hash) && data[:skills].is_a?(Array)
        raise MalformedEvaluationError, 'AI output missing required "skills" array'
      end

      @scrubber.scrub_payload(data)
    rescue JSON::ParserError
      raise MalformedEvaluationError, 'AI output was not valid JSON'
    end

    class EvaluationTimeoutError < StandardError; end
    class EvaluationFailureError < StandardError; end
    class MalformedEvaluationError < StandardError; end
  end
end