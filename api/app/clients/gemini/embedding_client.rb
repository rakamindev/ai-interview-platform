# frozen_string_literal: true

module Gemini
  # Client for generating 768-dimensional semantic embeddings via Gemini text-embedding-004 REST API.
  class EmbeddingClient
    BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'
    DEFAULT_MODEL = 'text-embedding-004'

    attr_reader :api_key, :model, :timeout

    def initialize(organization: nil, api_key: nil, model: nil, timeout: 15)
      resolved_org = organization || (defined?(Current) ? Current.tenant : nil)
      @api_key = api_key || resolved_org&.gemini_api_key || ENV['GEMINI_API_KEY']
      raise ArgumentError, 'Gemini API key is required' if @api_key.blank?

      @model = model || DEFAULT_MODEL
      @timeout = timeout
      @connection = build_connection
    end

    # Embeds a single text string into a 768-dimensional float array.
    def embed(text)
      return [] if text.blank?

      response = @connection.post(embed_url, request_body(text), request_headers)
      parse_response(response)
    rescue Faraday::TimeoutError => e
      raise HttpClient::TimeoutError.new("Gemini embedding timeout after #{@timeout}s: #{e.message}")
    rescue Faraday::Error => e
      raise HttpClient::ApiError.new("Gemini embedding API error: #{e.message}")
    end

    private

    def embed_url
      "#{BASE_URL}/models/#{@model}:embedContent"
    end

    def request_headers
      { 'Content-Type' => 'application/json', 'x-goog-api-key' => @api_key }
    end

    def request_body(text)
      {
        model: "models/#{@model}",
        content: {
          parts: [{ text: text.to_s.truncate(2000) }]
        }
      }.to_json
    end

    def build_connection
      Faraday.new do |f|
        f.request :retry, {
          max: 2,
          interval: 0.5,
          retry_statuses: [429, 500, 502, 503]
        }
        f.options.timeout = @timeout
        f.options.open_timeout = 5
        f.adapter Faraday.default_adapter
      end
    end

    def parse_response(response)
      unless response.success?
        if response.status == 429
          raise HttpClient::RateLimitError.new('Gemini embedding rate limited', status: 429, body: response.body)
        end

        raise HttpClient::ApiError.new("Embedding API returned #{response.status}", status: response.status, body: response.body)
      end

      data = JSON.parse(response.body)
      values = data.dig('embedding', 'values')

      raise HttpClient::ApiError.new('No embedding values returned from Gemini') if values.blank?

      values.map(&:to_f)
    end
  end
end
