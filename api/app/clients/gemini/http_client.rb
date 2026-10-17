# frozen_string_literal: true

module Gemini
  class HttpClient
    BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'

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

    FALLBACK_MODELS = %w[gemini-3.5-flash gemini-flash-lite-latest gemini-3.5-flash-lite gemini-flash-latest].freeze

    def initialize(model: nil, api_key: nil, timeout: 60)
      @model = model || ENV.fetch('GEMINI_FLASH_MODEL', 'gemini-3.5-flash')
      @api_key = api_key || ENV.fetch('GEMINI_API_KEY')
      @timeout = timeout
      @connection = build_connection
    end

    # Generates content using Gemini REST API with automatic multi-model failover.
    # Returns parsed JSON response body.
    def generate_content(prompt, temperature: 0.2, fallback_allowed: true)
      attempt_generate(@model, prompt, temperature)
    rescue RateLimitError => e
      raise unless fallback_allowed

      models_to_try = FALLBACK_MODELS.reject { |m| m == @model }
      models_to_try.each do |fallback|
        Rails.logger.warn("[Gemini::HttpClient] #{@model} hit RateLimitError (429). Trying fallback #{fallback}...")
        begin
          return attempt_generate(fallback, prompt, temperature)
        rescue RateLimitError
          next
        end
      end

      raise e
    end

    private

    def attempt_generate(model, prompt, temperature)
      response = @connection.post(generate_url(model), request_body(prompt, temperature), request_headers)
      parse_response(response)
    rescue Faraday::TimeoutError => e
      raise TimeoutError.new("Gemini API timeout after #{@timeout}s: #{e.message}")
    rescue Faraday::Error => e
      raise ApiError.new("Gemini API error: #{e.message}")
    end

    def generate_content_with_model(prompt, model, temperature: 0.2)
      attempt_generate(model, prompt, temperature)
    end

    def generate_url(model = @model)
      "#{BASE_URL}/models/#{model}:generateContent"
    end

    def request_headers
      { 'Content-Type' => 'application/json', 'x-goog-api-key' => @api_key }
    end

    def request_body(prompt, temperature)
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: temperature }
      }.to_json
    end

    def build_connection
      Faraday.new do |f|
        f.request :retry, {
          max: 2,
          interval: 0.5,
          retry_statuses: [500, 502, 503],
          retry_block: ->(env, _opts, retries, exc) {
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
