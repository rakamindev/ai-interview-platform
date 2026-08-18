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

    def initialize(model: nil, api_key: nil, timeout: 60, adapter: nil)
      @model = model
      @api_key = api_key || ENV.fetch('GEMINI_API_KEY')
      @timeout = timeout
      @adapter = adapter
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
        # 429 is deliberately NOT retried here: it is handled by raising
        # RateLimitError so the durable job queue (Sidekiq) schedules the
        # retry with proper backoff instead of hammering the quota away.
        f.request :retry, {
          max: 2,
          interval: 1,
          interval_randomness: 0.5,
          backoff_factor: 2,
          retry_statuses: [500, 502, 503],
          retry_block: ->(env, _opts, retries, exc) {
            retry_after = env&.response_headers&.[]('retry-after')&.to_i
            sleep([retry_after || 1, 15].min) if env&.status.to_i.between?(500, 503)
            Rails.logger.warn("[Gemini::HttpClient] Retry ##{retries} for #{@model}: #{exc&.message}")
          }
        }
        f.options.timeout = @timeout
        f.options.open_timeout = 10
        if @adapter
          f.adapter(*@adapter)
        else
          f.adapter Faraday.default_adapter
        end
      end
    end

    def parse_response(response)
      unless response.success?
        if response.status == 429
          retry_after = response.headers['retry-after']
          hint = retry_after ? " — coba lagi dalam ~#{retry_after}s atau cek kuota" : ' — kuota mungkin habis atau melampaui batas'
          raise RateLimitError.new("Gemini API rate limit tercapai#{hint}", status: response.status, body: response.body)
        end
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
