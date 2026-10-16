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

    def initialize(model: nil, api_key: nil, timeout: 60)
      @model = model
      @api_key = api_key || ENV.fetch('GEMINI_API_KEY')
      @timeout = timeout
      @connection = build_connection
    end

    # Generates content using Gemini REST API.
    # Returns parsed JSON response body.
    def generate_content(prompt, temperature: 0.2)
      if @api_key.blank? || @api_key == 'your_gemini_api_key'
        return mock_generate_content(prompt)
      end

      response = @connection.post(generate_url, request_body(prompt, temperature), request_headers)
      parse_response(response)
    rescue Faraday::TimeoutError => e
      raise TimeoutError.new("Gemini API timeout after #{@timeout}s: #{e.message}")
    rescue Faraday::Error => e
      raise ApiError.new("Gemini API error: #{e.message}")
    end

    private

    def mock_generate_content(prompt)
      Rails.logger.info("[Gemini::HttpClient] Mock response generated for model #{@model}")
      if prompt.include?('SKILL DEFINITIONS AND BEHAVIORAL ANCHORS') || prompt.include?('FINAL COVERAGE MAP')
        # N10: Portfolio Generator
        {
          'configured_skills' => [
            {
              'skill_id' => 'SK-ENG-006',
              'skill_label' => 'Testing & Quality Assurance',
              'level' => 3,
              'confidence' => 'high',
              'evidence' => [
                'I lead the QA automation pipeline using Playwright and Jest with extensive coverage for REST APIs.',
                'We assert repeatable state changes and use schema validation against OpenAPI contracts.'
              ],
              'competency_summary' => 'Demonstrates consistent proficiency in automated testing pipelines, test framework selection, and API contract validation. Handles complex integration scenarios reliably.'
            },
            {
              'skill_id' => 'SK-ENG-005',
              'skill_label' => 'RESTful API Design',
              'level' => 3,
              'confidence' => 'high',
              'evidence' => [
                'For idempotent endpoints like PUT and DELETE, we assert repeatable state changes and use schema validation against OpenAPI contracts.'
              ],
              'competency_summary' => 'Solid understanding of HTTP semantics, idempotency, and contract validation standards.'
            }
          ],
          'discovered_skills' => []
        }
      elsif prompt.include?('CURRENT COVERAGE MAP:') || prompt.include?('TRANSCRIPT TURNS:')
        # N7: Coverage Analyzer
        {
          'skill_updates' => [
            {
              'id' => 'Testing & Quality Assurance',
              'new_state' => 'covered',
              'new_probe_count' => 2,
              'reason' => 'Candidate provided detailed explanation of automated testing architecture and contract validation.'
            },
            {
              'id' => 'RESTful API Design',
              'new_state' => 'covered',
              'new_probe_count' => 2,
              'reason' => 'Candidate discussed REST semantics, idempotency, and OpenAPI schema testing.'
            }
          ],
          'discovered_skills' => []
        }
      elsif prompt.include?('CULTURE EXPECTATIONS:') || prompt.include?('SKILL COMPARISON RESULTS:')
        # N13: Fit/Gap narrative
        {
          'culture_narrative' => 'Candidate demonstrates strong analytical problem-solving and systematic approach to software quality. Communication is structured and clear.',
          'overall_narrative' => 'Strong match for quality engineering positions with solid test automation and REST API competencies meeting expected proficiency levels.'
        }
      else
        { 'status' => 'mocked', 'text' => 'Mock output' }
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
