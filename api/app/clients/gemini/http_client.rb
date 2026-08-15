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

    def initialize(model: nil, api_key: nil, timeout: 60)
      @model = model
      @api_key = api_key || ENV.fetch('GEMINI_API_KEY')
      @timeout = timeout
      @connection = build_connection
    end

    # Generates content using Gemini REST API with automatic 429 backoff and model fallback.
    # Returns parsed JSON response body.
    def generate_content(prompt, temperature: 0.2)
      models_to_try = [@model, 'gemini-2.5-flash', 'gemini-1.5-flash'].compact.uniq
      last_error = nil

      models_to_try.each do |current_model|
        url = "#{BASE_URL}/models/#{current_model}:generateContent"

        3.times do |attempt|
          response = @connection.post(url, request_body(prompt, temperature), request_headers)

          if response.status == 429
            backoff = (attempt + 1) * 2
            Rails.logger.warn("[Gemini::HttpClient] Rate limited (429) on #{current_model} (attempt #{attempt + 1}/3) — waiting #{backoff}s")
            sleep(backoff)
            next
          end

          return parse_response(response)
        rescue Faraday::TimeoutError => e
          last_error = TimeoutError.new("Gemini API timeout after #{@timeout}s: #{e.message}")
        rescue RateLimitError => e
          last_error = e
        rescue Faraday::Error => e
          last_error = ApiError.new("Gemini API error: #{e.message}")
        end
      end

      raise last_error || RateLimitError.new("Rate limited across models")
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
