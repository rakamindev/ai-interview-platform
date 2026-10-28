# frozen_string_literal: true

module Gemini
  # REST client for generateContent calls (coverage analysis, fit/gap
  # narratives, portfolio generation, connectivity checks).
  #
  # Contract of #generate_content:
  #   * returns a Hash (never a raw String — callers can no longer half-parse)
  #   * raises a Gemini::Errors::* subclass on any problem
  #   * logs one structured line per call with latency and token counts, but
  #     never the prompt, the completion or the API key
  class HttpClient
    BASE_URL = 'https://generativelanguage.googleapis.com/v1'

    # Constants that used to live on this class, kept so existing rescue
    # clauses and any external callers keep resolving.
    ApiError             = Errors::ApiError
    RateLimitError       = Errors::RateLimitError
    TimeoutError         = Errors::TimeoutError
    InvalidResponseError = Errors::InvalidResponseError
    NotConfiguredError   = Errors::NotConfiguredError

    DEFAULT_TIMEOUT    = 60
    DEFAULT_RETRY_MAX  = 2
    DEFAULT_RETRY_WAIT = 10

    METHODS_TO_RETRY = %i[post get head put delete].freeze
    EXCEPTIONS_TO_RETRY = [
      'Errno::ETIMEDOUT', 'Errno::ECONNRESET', 'Errno::ECONNREFUSED',
      'Timeout::Error', 'SocketError',
      Faraday::TimeoutError, Faraday::ConnectionFailed, Faraday::SSLError,
      'Faraday::RetriableResponse'
    ].freeze

    # finishReason values where the payload is unusable. Truncated output is
    # not listed: that surfaces when the incomplete text fails to parse.
    BLOCKED_FINISH_REASONS = %w[SAFETY RECITATION PROHIBITED_CONTENT CONTENT_FILTER MALFORMED].freeze

    attr_reader :model, :role, :timeout

    # role:    an application call-site role (:analysis, :narrative,
    #          :portfolio, :check) resolving model, timeout and retry policy
    #          via Config. Explicit model/timeout keywords win over the role.
    # api_key: test override; otherwise Config.api_key.
    #
    # Raises NotConfiguredError at construction when the feature is disabled
    # or no key is available — never a KeyError out of ENV.
    def initialize(role: nil, model: nil, api_key: nil, timeout: nil, retry_max: nil, retry_wait: nil)
      resolved = role ? Config.by_role(role) : {}

      @role       = role || :custom
      @model      = value_or(model) || resolved[:model] || Config.model(:flash)
      @timeout    = timeout || resolved[:timeout] || DEFAULT_TIMEOUT
      @retry_max  = retry_max || resolved[:retry_max] || DEFAULT_RETRY_MAX
      @retry_wait = retry_wait || resolved[:retry_wait] || Config.max_retry_wait
      @api_key    = value_or(api_key) || Config.api_key

      unless Config.enabled?
        raise NotConfiguredError,
              'GEMINI_ENABLED=false — this deployment has AI features turned off'
      end
      if Config.key_state != :set
        raise NotConfiguredError, Config.key_state == :placeholder ?
          'GEMINI_API_KEY looks like a placeholder — replace it with a real Google AI Studio key' :
          'GEMINI_API_KEY is not set — set it, or run locally with GEMINI_MOCK_MODE=true'
      end

      @connection = build_connection
    end

    # Prompts are sent as a single text part; returns a parsed Hash.
    def generate_content(prompt, temperature: 0.2)
      started = monotonic
      response = @connection.post(generate_url, request_body(prompt, temperature), request_headers)
      parse_response(response, prompt, started)
    rescue Faraday::TimeoutError
      raise log_and_raise(
        Errors::TimeoutError.new(
          "Gemini #{@model} exceeded the #{@timeout}s timeout (#{latency_ms(started)}ms elapsed)"
        ),
        'timeout', started: started, prompt: prompt
      )
    rescue Faraday::Error => e
      raise log_and_raise(faraday_error(e, started), 'transport_error', started: started, prompt: prompt)
    end

    private

    def value_or(value)
      value.present? ? value : nil
    end

    def monotonic
      Process.clock_gettime(Process::CLOCK_MONOTONIC)
    end

    def latency_ms(started)
      ((monotonic - started) * 1000).round
    end

    def generate_url
      "#{BASE_URL}/models/#{@model}:generateContent"
    end

    def request_headers
      { 'Content-Type' => 'application/json', 'x-goog-api-key' => @api_key }
    end

    # responseMimeType asks the API to constrain output to JSON; temperature is
    # kept at the value each call site already relied on for behaviour.
    def request_body(prompt, temperature)
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: temperature, responseMimeType: 'application/json' }
      }.to_json
    end

    def build_connection
      Faraday.new do |f|
        f.request :retry, {
          max: @retry_max,
          interval: 1,
          interval_randomness: 0.5,
          backoff_factor: 2,
          # Caps both the computed backoff and any Retry-After header. A cap
          # that Retry-After exceeds means "do not wait, answer now" — the
          # response comes back as-is and is mapped to RateLimitError.
          max_interval: @retry_wait,
          methods: METHODS_TO_RETRY,
          exceptions: EXCEPTIONS_TO_RETRY,
          retry_statuses: [429, 500, 502, 503],
          retry_block: method(:on_retry)
        }
        f.options.timeout = @timeout
        f.options.open_timeout = Config.open_timeout
        f.adapter Faraday.default_adapter
      end
    end

    # Faraday-retry sleeps itself right after this returns, so this only
    # records the event. Signature is keyword-based as of faraday-retry 2.x;
    # a positional lambda here raises ArgumentError and kills the retry path.
    def on_retry(env:, options:, retry_count:, exception:, will_retry_in:)
      log_call(:warn,
               classification: 'retry',
               attempt: retry_count,
               wait_s: will_retry_in&.round(1),
               status: env&.status,
               detail: exception.message)
    end

    def parse_response(response, prompt, started)
      unless response.success?
        error = map_http_error(response.status, response.body)
        raise log_and_raise(error, 'http_error',
                            started: started, prompt: prompt,
                            status: response.status, detail: error.message)
      end

      body = response.body.to_s
      data = begin
        JSON.parse(body)
      rescue JSON::ParserError, TypeError
        raise log_and_raise(
          Errors::InvalidResponseError.new(
            "Gemini returned a non-JSON body (#{@model}, #{body.bytesize} bytes, " \
            "content-type #{response.headers['content-type'] || 'unknown'})"
          ),
          'invalid_body', started: started, prompt: prompt, status: response.status
        )
      end

      block_reason = data.dig('promptFeedback', 'blockReason')
      if block_reason.present?
        # Structural reason only (an enum), never the prompt itself.
        raise log_and_raise(
          Errors::InvalidResponseError.new("Gemini blocked the request (promptFeedback: #{block_reason})"),
          'prompt_blocked', started: started, prompt: prompt, status: response.status
        )
      end

      finish     = data.dig('candidates', 0, 'finishReason').to_s
      completion = extract_text(data)

      if BLOCKED_FINISH_REASONS.include?(finish)
        raise log_and_raise(
          Errors::InvalidResponseError.new("Gemini refused the request (finishReason=#{finish})"),
          'refused', started: started, prompt: prompt, status: response.status
        )
      end

      parsed = parse_completion(completion, finish)
      log_call(:info, classification: 'ok', started: started, prompt: prompt,
               status: response.status, raw: data, response: parsed, finish_reason: finish)
      parsed
    end

    # Gemini can return several parts (text plus thought metadata); text is
    # all we want back.
    def extract_text(data)
      data.dig('candidates', 0, 'content', 'parts').to_a.filter_map { |part| part['text'] }.join
    end

    def parse_completion(text, finish)
      if text.strip.empty?
        raise Errors::InvalidResponseError.new(
          "Gemini returned an empty completion (finishReason=#{finish.presence || 'unknown'})"
        ).tap { |e| log_call(:error, classification: 'empty', detail: e.message) }
      end

      cleaned = text.strip.sub(/\A```(?:json)?\s*/i, '').sub(/\s*```\z/, '')

      parsed = begin
        JSON.parse(cleaned)
      rescue JSON::ParserError
        raise Errors::InvalidResponseError.new(
          "Gemini output was not valid JSON (model=#{@model}, " \
          "finishReason=#{finish.presence || 'unknown'}, #{cleaned.length} chars)"
        ).tap { |e| log_call(:error, classification: 'invalid_completion', detail: e.message) }
      end

      unless parsed.is_a?(Hash)
        raise Errors::InvalidResponseError.new(
          "Gemini returned JSON of type #{parsed.class}, expected an object (model=#{@model})"
        ).tap { |e| log_call(:error, classification: 'wrong_shape', detail: e.message) }
      end

      parsed
    end

    def map_http_error(status, body)
      case status
      when 429
        Errors::RateLimitError.new
      when 401, 403
        Errors::ApiError.new(
          "Gemini rejected the request (HTTP #{status}) — check GEMINI_API_KEY and that #{@model} " \
          'is enabled for this project',
          status: status
        )
      when 404
        Errors::ApiError.new(
          "Gemini model not found: #{@model} — set the matching GEMINI_*_MODEL " \
          '(run rake gemini:models to see what this key can call)',
          status: status
        )
      when 400
        # Message is structural: status only. The response body for a 400 can
        # quote prompt content back, so it is length-summarised instead.
        Errors::ApiError.new(
          "Gemini rejected the request payload (HTTP 400, #{body.to_s.bytesize} bytes) — " \
          'check the prompt and generationConfig for this model',
          status: status
        )
      when 500..599
        Errors::ApiError.new("Gemini server error (HTTP #{status})", status: status, retryable: true)
      else
        Errors::ApiError.new("Gemini request failed (HTTP #{status})", status: status)
      end
    end

    def faraday_error(error, started)
      status = faraday_status(error)
      return map_http_error(status, faraday_body(error)) if status

      Errors::ApiError.new(
        "Gemini connection failed (#{error.class}: #{truncate(error.message)}) after #{latency_ms(started)}ms"
      )
    end

    def faraday_status(error)
      response = error.respond_to?(:response) ? error.response : nil
      return nil unless response.is_a?(Hash)

      response[:status] || response['status']
    end

    def faraday_body(error)
      response = error.respond_to?(:response) ? error.response : nil
      return nil unless response.is_a?(Hash)

      response[:body] || response['body']
    end

    def log_and_raise(error, classification, started: nil, prompt: nil, status: nil, detail: nil)
      log_call(:error, classification: classification, started: started, prompt: prompt,
               status: status, detail: detail || error.message)
      error
    end

    # One line per call: enough to debug latency, cost and failures, without
    # ever carrying a candidate transcript, model output or credentials.
    def log_call(level, classification:, started: nil, prompt: nil, status: nil, attempt: nil,
                 wait_s: nil, detail: nil, response: nil, raw: nil, finish_reason: nil)
      fields = { role: @role, model: @model, classification: classification }
      fields[:status]       = status if status
      fields[:latency_ms]   = latency_ms(started) if started
      fields[:prompt_chars] = prompt.to_s.length if prompt
      fields[:attempt]      = attempt if attempt
      fields[:wait_s]       = wait_s if wait_s

      usage = raw.is_a?(Hash) ? raw['usageMetadata'] : nil
      if usage.is_a?(Hash)
        fields[:prompt_tokens] = usage['promptTokenCount']
        fields[:output_tokens] = usage['candidatesTokenCount'] || usage['totalTokenCount']
      end

      fields[:finish_reason] = finish_reason if finish_reason
      fields[:response_chars] = response.to_json.length if response.is_a?(Hash)

      message = "[Gemini] #{fields.compact.map { |k, v| "#{k}=#{v}" }.join(' ')}"
      message += " detail=#{truncate(detail)}" if detail

      Rails.logger.public_send(level, message)
    end

    def truncate(text, limit = 240)
      value = text.to_s.gsub(/\s+/, ' ').strip
      value.length > limit ? "#{value[0, limit]}…" : value
    end
  end
end