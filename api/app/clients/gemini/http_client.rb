# frozen_string_literal: true

module Gemini
  class HttpClient
    BASE_URL = ENV.fetch('GEMINI_API_BASE_URL', 'https://generativelanguage.googleapis.com/v1beta')

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

    def initialize(model: nil, api_key: nil, timeout: 60, base_url: nil, adapter: Faraday.default_adapter, adapter_options: nil, retry_options: {})
      @model = model
      @api_key = api_key || ENV.fetch('GEMINI_API_KEY')
      @timeout = timeout
      @base_url = base_url || BASE_URL
      @adapter = adapter
      @adapter_options = adapter_options
      @retry_options = retry_options || {}
      @connection = build_connection
    end

    # Generates content using Gemini REST API.
    # Returns parsed JSON response body.
    def generate_content(prompt, temperature: 0.2)
      response = @connection.post(generate_url, request_body(prompt, temperature), request_headers)
      parse_response(response)
    rescue Faraday::TimeoutError => e
      raise TimeoutError.new("Gemini API timeout after #{@timeout}s: #{e.message}")
    rescue Faraday::Error => e
      raise ApiError.new("Gemini API error: #{e.message}")
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
        default_retry_options = {
          max: 3,
          interval: 1,
          interval_randomness: 0.5,
          backoff_factor: 2,
          methods: Faraday::Retry::Middleware::IDEMPOTENT_METHODS + [:post],
          retry_statuses: [429, 500, 502, 503],
          retry_block: ->(retry_count:, exception: nil, **_kwargs) {
            Rails.logger.warn("[Gemini::HttpClient] Retry ##{retry_count} for #{@model}: #{exception&.message}")
          }
        }
        f.request :retry, default_retry_options.merge(@retry_options)
        f.options.timeout = @timeout
        f.options.open_timeout = 10
        f.adapter(*[@adapter, @adapter_options].compact)
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
