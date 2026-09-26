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
    # The call worked, but the answer had no text in it.
    class EmptyResponseError < ApiError; end

    # generateContent is a POST, but calling it again changes nothing, so short
    # errors (rate limit, "busy", a dropped connection) are safe to retry.
    # Slow answers (timeouts) are not retried here; the job queue retries those.
    RETRY_OPTIONS = {
      max: 3,
      interval: 1,
      interval_randomness: 0.5,
      backoff_factor: 2,
      max_interval: 10,
      methods: %i[post],
      retry_statuses: [429, 500, 502, 503, 504],
      exceptions: [Faraday::ConnectionFailed, Faraday::RetriableResponse]
    }.freeze

    def initialize(model: nil, api_key: nil, timeout: 60)
      @model = model
      @api_key = api_key || ENV.fetch('GEMINI_API_KEY')
      @timeout = timeout
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
        f.request :retry, RETRY_OPTIONS.merge(
          # faraday-retry passes keyword arguments. It also waits for Retry-After
          # when Google sends one, up to max_interval; longer waits go to the job queue.
          retry_block: lambda { |env:, retry_count:, will_retry_in:, **|
            Rails.logger.warn(
              "[Gemini::HttpClient] #{@model} answered #{env&.status || 'no response'}; " \
              "retry #{retry_count + 1} in #{will_retry_in.round(1)}s"
            )
          }
        )
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

      raise EmptyResponseError.new("No content in Gemini response") unless text

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
