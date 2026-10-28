# frozen_string_literal: true

module Gemini
  # Maps a Gemini client error to a safe, enumerable code that can be stored
  # and shown; provider messages and bodies are never used.
  module ErrorCode
    module_function

    def for(error)
      case error
      when Gemini::HttpClient::TimeoutError then 'timeout'
      when Gemini::HttpClient::RateLimitError then 'rate_limited'
      when Gemini::HttpClient::ApiError then for_status(error.status)
      else 'unknown'
      end
    end

    def for_status(status)
      case status
      when 401, 403 then 'provider_denied'
      when 429 then 'rate_limited'
      when 500..599 then 'provider_unavailable'
      else 'unknown'
      end
    end
  end
end
