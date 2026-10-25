# frozen_string_literal: true

module Gemini
  class HttpClient
    BASE_URL = 'https://generativelanguage.googleapis.com/v1'

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

    # Network-layer failures carry no HTTP status; without a synthetic one the
    # fallback gate below sees status nil and re-raises past every fallback
    # model. 503 = "model unusable right now", 502 = unusable response payload.
    NETWORK_FAILURE_STATUS = 503
    EMPTY_RESPONSE_STATUS = 502

    def initialize(model: nil, api_key: nil, timeout: 60, fallback_models: [], connection: nil)
      @model = model
      @fallback_models = Array(fallback_models)
      @api_key = api_key || ENV.fetch('GEMINI_API_KEY')
      @timeout = timeout
      @connection = connection || build_connection
    end

    # Generates content using Gemini REST API.
    # Returns parsed JSON response body.
    # Retried across @fallback_models when the configured model is rejected (404 model-not-found).
    def generate_content(prompt, temperature: 0.2)
      candidates = ([@model] + @fallback_models).compact.uniq
      last_error = nil

      candidates.each_with_index do |candidate, i|
        @model = candidate
        begin
          return perform_generate(prompt, temperature)
        rescue ApiError => e
          last_error = e
          raise unless fallback_condition?(e)
          raise if i == candidates.length - 1

          Rails.logger.warn("[Gemini::HttpClient] Model #{candidate} rejected (#{e.message}) — falling back to #{candidates[i + 1]}")
        end
      end

      raise last_error
    end

    private

    def perform_generate(prompt, temperature)
      response = @connection.post(generate_url, request_body(prompt, temperature), request_headers)
      parse_response(response)
    rescue Faraday::TimeoutError => e
      raise TimeoutError.new("Gemini API timeout after #{@timeout}s: #{e.message}", status: NETWORK_FAILURE_STATUS)
    rescue Faraday::Error => e
      raise ApiError.new("Gemini API error: #{e.class}: #{e.message}", status: NETWORK_FAILURE_STATUS)
    end

    # Triggers model fallback when the current model is rejected or unusable right now:
    # 404 not-found/not-supported, 429 quota, 503 high demand or network failure
    # (synthesized above), 502 empty payload (synthesized in parse_response).
    def fallback_condition?(error)
      case error.status
      when 404 then error.body.to_s.match?(/not found|not supported/i)
      when 429, 502, 503 then true
      else false
      end
    end

    def generate_url
      "#{BASE_URL}/models/#{@model}:generateContent"
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

      raise ApiError.new("No content in Gemini response", status: EMPTY_RESPONSE_STATUS) unless text

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
