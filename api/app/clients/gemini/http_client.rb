# frozen_string_literal: true

module Gemini
  class HttpClient
    BASE_URL = 'https://generativelanguage.googleapis.com/v1'
    INTERACTIONS_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions'

    # Keys created in AI Studio are "auth keys" (AQ. prefix), which are rejected
    # by models/*:generateContent but accepted by the Interactions API.
    # GEMINI_HTTP_API=interactions switches to it; the default keeps the
    # existing behaviour.
    APIS = %w[generate_content interactions].freeze

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

    def initialize(model: nil, api_key: nil, timeout: 60, api: nil, connection: nil)
      @model = model
      @api_key = api_key || ENV.fetch('GEMINI_API_KEY')
      @timeout = timeout
      @api = (api || ENV.fetch('GEMINI_HTTP_API', 'generate_content')).to_s
      raise ArgumentError, "Unknown GEMINI_HTTP_API #{@api.inspect}" unless APIS.include?(@api)

      @connection = connection || build_connection
    end

    # Generates content using Gemini REST API.
    # Returns parsed JSON response body.
    def generate_content(prompt, temperature: 0.2)
      response = @connection.post(request_url, request_body(prompt, temperature), request_headers)
      parse_response(response)
    rescue Faraday::TimeoutError => e
      raise TimeoutError.new("Gemini API timeout after #{@timeout}s: #{e.message}")
    rescue Faraday::Error => e
      raise ApiError.new("Gemini API error: #{e.message}")
    end

    private

    def interactions? = @api == 'interactions'

    def request_url
      interactions? ? INTERACTIONS_URL : "#{BASE_URL}/models/#{@model}:generateContent"
    end

    def request_headers
      { 'Content-Type' => 'application/json', 'x-goog-api-key' => @api_key }
    end

    def request_body(prompt, temperature)
      if interactions?
        # store: false, so transcripts are not kept on Google's side for
        # follow-up interactions we never make.
        { model: @model, input: prompt, store: false, generation_config: { temperature: temperature } }.to_json
      else
        {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: temperature }
        }.to_json
      end
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
        # The body can echo the prompt, which contains transcript text, so only the status is logged.
        Rails.logger.error("[Gemini::HttpClient] API error #{response.status} for #{@model}")
        raise ApiError.new("API returned #{response.status}", status: response.status, body: response.body)
      end

      data = JSON.parse(response.body)
      text = interactions? ? interaction_text(data) : data.dig('candidates', 0, 'content', 'parts', 0, 'text')

      raise ApiError.new("No content in Gemini response") unless text

      # Strip markdown code fences if present (e.g. ```json ... ```)
      cleaned = text.strip.sub(/\A```(?:json)?\s*/, '').sub(/\s*```\z/, '')

      begin
        JSON.parse(cleaned)
      rescue JSON::ParserError
        cleaned
      end
    end

    def interaction_text(data)
      status = data['status']
      # 'incomplete' means the output was cut off (e.g. max tokens); half a JSON
      # document must not be treated as an answer.
      raise ApiError.new("Interaction #{status || 'returned no status'}") unless status == 'completed'

      texts = Array(data['steps'])
              .select { |step| step['type'] == 'model_output' }
              .flat_map { |step| Array(step['content']) }
              .select { |part| part['type'] == 'text' }
              .map { |part| part['text'] }
      texts.join.presence
    end
  end
end
