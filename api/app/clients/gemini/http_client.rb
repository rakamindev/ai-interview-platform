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

    # Generates content using Gemini REST API.
    # Returns parsed JSON response body.
    def generate_content(prompt, temperature: 0.2)
      retries = 0
      begin
        response = @connection.post(generate_url, request_body(prompt, temperature), request_headers)
        parse_response(response)
      rescue RateLimitError => e
        retries += 1
        if retries <= 5
          Rails.logger.warn("[Gemini::HttpClient] Rate limited (429). Retry ##{retries} for #{@model} after 15s")
          sleep(15)
          retry
        else
          raise
        end
      rescue Faraday::TimeoutError, Faraday::ConnectionFailed => e
        retries += 1
        raise TimeoutError.new("Gemini API network error: #{e.message}") if retries > 3
        
        sleep_time = 2 ** retries
        Rails.logger.warn("[Gemini::HttpClient] Network error (#{e.class}). Retry ##{retries} for #{@model} after #{sleep_time}s")
        sleep(sleep_time)
        retry
      rescue ApiError => e
        # Only retry on 5xx server errors
        raise unless e.status && e.status >= 500
        
        retries += 1
        raise if retries > 3
        
        sleep_time = 2 ** retries
        Rails.logger.warn("[Gemini::HttpClient] Server error (#{e.status}). Retry ##{retries} for #{@model} after #{sleep_time}s")
        sleep(sleep_time)
        retry
      rescue Faraday::Error => e
        raise ApiError.new("Gemini API error: #{e.message}")
      end
    end

    private

    def generate_url
      "#{BASE_URL}/models/#{@model}:generateContent?key=#{@api_key}"
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

      # Robustly extract JSON from markdown fences if present
      cleaned = if text.match?(/```(?:json)?\s*(.*?)\s*```/m)
                  text[/```(?:json)?\s*(.*?)\s*```/m, 1]
                else
                  text.strip
                end

      begin
        JSON.parse(cleaned)
      rescue JSON::ParserError
        cleaned
      end
    end
  end
end
