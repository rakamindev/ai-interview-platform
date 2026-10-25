# frozen_string_literal: true

require 'base64'

module Gemini
  class HttpClient
    BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'
    FALLBACK_MODELS = %w[
      gemini-2.5-flash
      gemini-3-flash-preview
      gemini-flash-latest
      gemini-3.1-pro-preview
    ].freeze

    class ApiError < StandardError
      attr_reader :status, :body

      def initialize(message, status: nil, body: nil)
        @status = status
        @body = body
        super(message)
      end
    end

    class RateLimitError < ApiError; end
    class TimeoutError < ApiError; end

    def initialize(model: nil, api_key: nil, timeout: 60)
      @model = model.presence || 'gemini-2.5-flash'
      @api_key = api_key || ENV.fetch('GEMINI_API_KEY')
      @timeout = timeout
      @connection = build_connection
    end

    # Generates content using Gemini REST API.
    # Returns parsed JSON response body (or cleaned text string).
    def generate_content(prompt, temperature: 0.2)
      parts = [{ text: prompt }]
      post_with_model_fallback(parts, temperature: temperature)
    rescue Faraday::TimeoutError => e
      raise TimeoutError.new("Gemini API timeout after #{@timeout}s: #{e.message}")
    rescue Faraday::Error => e
      raise ApiError.new("Gemini API error: #{e.message}")
    end

    # Generates content from multimodal WAV audio + text prompt using Gemini REST API.
    def generate_content_with_audio(prompt, wav_bytes:, temperature: 0.3)
      parts = [
        {
          inlineData: {
            mimeType: 'audio/wav',
            data: Base64.strict_encode64(wav_bytes)
          }
        },
        { text: prompt }
      ]
      post_with_model_fallback(parts, temperature: temperature)
    rescue Faraday::TimeoutError => e
      raise TimeoutError.new("Gemini API timeout after #{@timeout}s: #{e.message}")
    rescue Faraday::Error => e
      raise ApiError.new("Gemini API error: #{e.message}")
    end

    private

    def post_with_model_fallback(parts, temperature:)
      candidates = ([@model] + FALLBACK_MODELS).compact.uniq
      last_response = nil

      candidates.each do |candidate_model|
        response = @connection.post(generate_url(candidate_model), request_body(parts, temperature), request_headers)
        last_response = response
        if response.status == 404
          Rails.logger.warn("[Gemini::HttpClient] Model #{candidate_model} returned 404 — trying next fallback model")
          next
        end
        return parse_response(response)
      end

      parse_response(last_response)
    end

    def generate_url(model_name = @model)
      "#{BASE_URL}/models/#{model_name}:generateContent"
    end

    def request_headers
      { 'Content-Type' => 'application/json', 'x-goog-api-key' => @api_key }
    end

    def request_body(parts, temperature)
      {
        contents: [{ parts: parts }],
        generationConfig: { temperature: temperature }
      }.to_json
    end

    def build_connection
      Faraday.new do |f|
        f.request :retry, {
          max: 3,
          interval: 1,
          interval_randomness: 0.5,
          backoff_factor: 2,
          retry_statuses: [429, 500, 502, 503],
          retry_block: ->(env, _opts, retries, exc) {
            retry_after = env&.response_headers&.[]('retry-after')&.to_i
            sleep([retry_after || 1, 30].min) if env&.status == 429
            Rails.logger.warn("[Gemini::HttpClient] Retry ##{retries} for #{@model}: #{exc&.message}")
          }
        }
        f.options.timeout = @timeout
        f.options.open_timeout = 10
        f.adapter Faraday.default_adapter
      end
    end

    def parse_response(response)
      unless response.success?
        raise RateLimitError.new("Rate limited", status: response.status, body: response.body) if response.status == 429
        Rails.logger.error("[Gemini::HttpClient] API error #{response.status}: #{response.body}")
        raise ApiError.new("API returned #{response.status}", status: response.status, body: response.body)
      end

      data = JSON.parse(response.body)
      text = data.dig('candidates', 0, 'content', 'parts', 0, 'text')

      raise ApiError.new("No content in Gemini response") unless text

      # Strip markdown code fences if present (e.g. ```json ... ```)
      cleaned = text.strip.sub(/\A```(?:json)?\s*/, '').sub(/\s*```\z/, '')

      begin
        JSON.parse(cleaned)
      rescue JSON::ParserError
        cleaned
      end
    end
  end
end
