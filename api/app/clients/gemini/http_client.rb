# frozen_string_literal: true

module Gemini
  class HttpClient
    BASE_URL = 'https://generativelanguage.googleapis.com/v1'
    BETA_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'

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

    def initialize(model: nil, api_key: nil, timeout: 60, api_version: 'v1')
      @model = model
      @api_key = api_key || ENV.fetch('GEMINI_API_KEY')
      @timeout = timeout
      @base_url = api_version == 'v1beta' ? BETA_BASE_URL : BASE_URL
      @connection = build_connection
    end

    # Generates content using Gemini REST API.
    # Returns parsed JSON response body.
    def generate_content(prompt, temperature: 0.2)
      response = @connection.post(generate_url, request_body(prompt, temperature), request_headers)
      parse_response(response)
    rescue Faraday::TimeoutError => e
      raise TimeoutError.new("The AI service took too long to respond. Please try again.")
    rescue Faraday::Error => e
      raise ApiError.new("The AI service could not be reached. Please try again.")
    end

    private

    def generate_url
      "#{@base_url}/models/#{@model}:generateContent"
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
        if response.status == 429
          raise RateLimitError.new("The AI service is busy right now. Please wait a minute and try again.", status: response.status, body: response.body)
        end
        Rails.logger.error("[Gemini::HttpClient] API error #{response.status}: #{response.body}")
        message = if response.status == 404
                    "The AI service is unavailable at the moment. Please try again in a few minutes."
                  else
                    "The AI service hit a problem. Please try again."
                  end
        raise ApiError.new(message, status: response.status, body: response.body)
      end

      data = JSON.parse(response.body)
      text = data.dig('candidates', 0, 'content', 'parts', 0, 'text')

      raise ApiError.new("The AI did not return a result. Please try again.") unless text

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
