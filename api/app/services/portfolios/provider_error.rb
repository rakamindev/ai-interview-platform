# frozen_string_literal: true

module Portfolios
  # Decides whether a failed Gemini call is worth retrying automatically (:temporary) or needs a
  # person to change the configuration first (:needs_admin). Uses the provider's own error message
  # where it is distinctive, and falls back to the HTTP status. The raw provider message is kept on
  # the generation so a person can always judge an unrecognised case.
  class ProviderError
    Result = Struct.new(:kind, :code, :provider_message, keyword_init: true) do
      def temporary? = kind == :temporary
    end

    # Codes an assessor cannot fix by trying again: an administrator must change the configuration.
    NEEDS_ADMIN_CODES = %w[model_unavailable auth_failed quota_exhausted bad_request].freeze

    QUOTA_PATTERN = /exceeded your current quota|billing|quota.*(exceeded|exhausted).*plan/i
    AUTH_PATTERN  = /api key|permission|unauthori[sz]ed|forbidden/i

    def self.classify(error)
      new(error).classify
    end

    def initialize(error)
      @error = error
    end

    def classify
      message = provider_message
      return temporary('timeout', message) if @error.is_a?(Gemini::HttpClient::TimeoutError)

      case @error.status
      when nil      then temporary('network_error', message)
      when 429      then message =~ QUOTA_PATTERN ? needs_admin('quota_exhausted', message) : temporary('rate_limited', message)
      when 500..599 then temporary('provider_error', message)
      when 404      then needs_admin('model_unavailable', message)
      when 401, 403 then needs_admin('auth_failed', message)
      when 400      then message =~ AUTH_PATTERN ? needs_admin('auth_failed', message) : needs_admin('bad_request', message)
      else               needs_admin('bad_request', message)
      end
    end

    private

    def temporary(code, message)   = Result.new(kind: :temporary, code: code, provider_message: message)
    def needs_admin(code, message) = Result.new(kind: :needs_admin, code: code, provider_message: message)

    # The provider explains itself in the JSON body ({"error":{"message":"…"}}); the exception
    # message is only "API returned 404". Never contains transcript content.
    def provider_message
      body = @error.respond_to?(:body) ? @error.body : nil
      parsed = body.is_a?(String) ? JSON.parse(body) : body
      (parsed.is_a?(Hash) && parsed.dig('error', 'message')).presence || @error.message
    rescue JSON::ParserError
      @error.message
    end
  end
end
