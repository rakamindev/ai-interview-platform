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
    class NetworkError < ApiError; end

    def initialize(model: nil, models: nil, api_key: nil, timeout: 60)
      @models = Array(models || model).flat_map { |value| value.to_s.split(',') }
                                                .map(&:strip)
                                                .reject(&:empty?)
      raise ArgumentError, 'At least one Gemini model is required' if @models.empty?

      @model = @models.first
      @api_key = api_key || ENV.fetch('GEMINI_API_KEY')
      @timeout = timeout
      @connection = build_connection
    end

    # Generates content using Gemini REST API.
    # Returns parsed JSON response body.
    def generate_content(prompt, temperature: 0.2)
      last_error = nil

      @models.each_with_index do |model, index|
        @model = model
        begin
          response = request_response(prompt, temperature, model)
          return parse_response(response, model)
        rescue TimeoutError, NetworkError, RateLimitError, ApiError => e
          last_error = e
          raise unless retryable?(e) && index < @models.length - 1

          Rails.logger.warn(
            "[Gemini::HttpClient] #{model} unavailable (#{e.message}); " \
            "falling back to #{@models[index + 1]}"
          )
        end
      end

      raise last_error
    end

    def retryable?(error)
      return true if error.is_a?(TimeoutError) || error.is_a?(NetworkError)

      error.is_a?(ApiError) && [429, 500, 502, 503].include?(error.status)
    end

    private

    def generate_url(model)
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

    def parse_response(response, model)
      unless response.success?
        raise RateLimitError.new("Rate limited", status: response.status, body: response.body) if response.status == 429
        Rails.logger.error("[Gemini::HttpClient] API error #{response.status} for #{model}: #{response.body}")
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

    def request_response(prompt, temperature, model)
      @connection.post(generate_url(model), request_body(prompt, temperature), request_headers)
    rescue Faraday::TimeoutError => e
      raise TimeoutError.new("Gemini API timeout after #{@timeout}s: #{e.message}")
    rescue Faraday::Error => e
      raise NetworkError.new("Gemini API error: #{e.message}")
    end
  end
end
