# frozen_string_literal: true

module Gemini
  # Gemini failure hierarchy.
  #
  # Everything raised by the Gemini layer is a Gemini::Errors::Error, so a
  # caller can rescue the whole family with one constant and re-raise the
  # caller's own errors untouched.
  #
  #   ConfigError / NotConfiguredError -> misconfiguration (fix the deploy)
  #   RateLimitError                   -> HTTP 429 after retries (back off, retry later)
  #   TimeoutError                     -> request took longer than the role timeout
  #   InvalidResponseError             -> 200 but unusable output (never persist it)
  #   ApiError                         -> any other transport/HTTP failure
  module Errors
    class Error < StandardError; end

    # The feature is off, the key is missing, or the role/model is unusable.
    class ConfigError < Error; end
    class NotConfiguredError < ConfigError; end

    class ApiError < Error
      attr_reader :status, :retryable

      def initialize(message, status: nil, retryable: false)
        @status = status
        @retryable = retryable
        super(message)
      end
    end

    # 429 survived the Faraday retries. Safe to retry later or run degraded.
    class RateLimitError < ApiError
      def initialize(message = 'Gemini rate limited after retries', status: 429)
        super(message, status: status, retryable: true)
      end
    end

    class TimeoutError < ApiError
      def initialize(message = 'Gemini request timed out', retryable: true)
        super(message, retryable: retryable)
      end
    end

    # The API answered but the payload cannot be used. The message is
    # structural only (counts, shapes, finish reasons) — never the candidate's
    # transcript or the model's text, both of which may contain PII.
    class InvalidResponseError < ApiError; end
  end
end