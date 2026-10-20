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

    attr_reader :model, :api_key, :timeout

    def initialize(organization: nil, model: nil, api_key: nil, timeout: 60)
      resolved_org = organization || (defined?(Current) ? Current.tenant : nil)
      @api_key = api_key || resolved_org&.gemini_api_key || ENV['GEMINI_API_KEY']
      raise ArgumentError, 'Gemini API key is required' if @api_key.blank?

      @model = model || resolved_org&.gemini_model(:pro) || ENV['GEMINI_PRO_MODEL'].presence || 'gemini-2.0-pro-exp-02-05'
      @timeout = timeout
      @connection = build_connection
    end

    # Generates content using Gemini REST API.
    # Returns parsed JSON response body.
    def generate_content(prompt, temperature: 0.2, response_mime_type: 'application/json', max_output_tokens: 8192)
      response = @connection.post(
        generate_url,
        request_body(prompt, temperature, response_mime_type: response_mime_type, max_output_tokens: max_output_tokens),
        request_headers
      )
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

    def request_body(prompt, temperature, response_mime_type: nil, max_output_tokens: nil)
      config = { temperature: temperature }
      config[:responseMimeType] = response_mime_type if response_mime_type.present?
      config[:maxOutputTokens] = max_output_tokens if max_output_tokens.present?

      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: config
      }.to_json
    end

    def build_connection
      Faraday.new do |f|
        f.request :retry, {
          max: 4,
          interval: 2,
          interval_randomness: 0.5,
          backoff_factor: 2,
          retry_statuses: [429, 500, 502, 503],
          methods: %i[delete get head options put trace post]
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

      parse_json_payload(text)
    end

    def parse_json_payload(text)
      cleaned = text.strip.sub(/\A```(?:json)?\s*/i, '').sub(/\s*```\z/, '').strip

      begin
        return JSON.parse(cleaned)
      rescue JSON::ParserError
        # 1. Try repairing cleaned payload (e.g. truncated closing brackets/quotes or trailing commas)
        repaired = repair_json_string(cleaned)
        return JSON.parse(repaired) if repaired

        # 2. Try extracting JSON structure if prose surrounded the payload
        extracted = extract_json_structure(cleaned)
        if extracted && extracted != cleaned
          begin
            return JSON.parse(extracted)
          rescue JSON::ParserError
            repaired_extracted = repair_json_string(extracted)
            return JSON.parse(repaired_extracted) if repaired_extracted
          end
        end

        cleaned
      end
    end

    def extract_json_structure(text)
      first_brace = text.index('{')
      first_bracket = text.index('[')

      return nil if first_brace.nil? && first_bracket.nil?

      if first_brace && (first_bracket.nil? || first_brace < first_bracket)
        last_brace = text.rindex('}')
        return text[first_brace..last_brace] if last_brace && last_brace > first_brace
      elsif first_bracket
        last_bracket = text.rindex(']')
        return text[first_bracket..last_bracket] if last_bracket && last_bracket > first_bracket
      end

      nil
    end

    def repair_json_string(raw)
      sanitized = raw.gsub(/,\s*([\}\]])/, '\1')

      begin
        JSON.parse(sanitized)
        return sanitized
      rescue JSON::ParserError
        salvage_truncated(sanitized)
      end
    end

    def salvage_truncated(str)
      in_string = false
      escaped = false
      stack = []

      str.each_char do |char|
        if escaped
          escaped = false
          next
        end

        if char == '\\'
          escaped = true
          next
        end

        if char == '"'
          in_string = !in_string
          next
        end

        next if in_string

        if char == '{' || char == '['
          stack.push(char)
        elsif char == '}' && stack.last == '{'
          stack.pop
        elsif char == ']' && stack.last == '['
          stack.pop
        end
      end

      repaired = str.dup
      repaired << '"' if in_string

      stack.reverse_each do |bracket|
        repaired << (bracket == '{' ? '}' : ']')
      end

      begin
        JSON.parse(repaired)
        repaired
      rescue JSON::ParserError
        nil
      end
    end
  end
end
