# frozen_string_literal: true

module Gemini
  # The single place that decides which AI client a service receives.
  #
  #   Gemini.client(:portfolio)  # -> MockClient or HttpClient
  #
  # Routing rules, in order:
  #   1. GEMINI_ENABLED=false            -> raises NotConfiguredError, loud and early
  #   2. GEMINI_MOCK_MODE=true / test env / no key outside production+staging
  #                                        -> MockClient (deterministic, no network)
  #   3. otherwise                        -> HttpClient, which itself refuses to
  #                                          build when no key is present
  module Factory
    class << self
      def client(role: nil, model: nil, api_key: nil, timeout: nil, retry_max: nil, retry_wait: nil)
        if !Config.enabled?
          raise Errors::NotConfiguredError,
                'GEMINI_ENABLED=false — this deployment has AI features turned off'
        end

        if Config.mock?
          MockClient.new(role: role, model: model)
        else
          HttpClient.new(role: role, model: model, api_key: api_key, timeout: timeout,
                         retry_max: retry_max, retry_wait: retry_wait)
        end
      end

      # Human-readable routing, used by rake gemini:check and diagnostics.
      def mode
        return :disabled unless Config.enabled?
        return :mock if Config.mock?
        return :unconfigured unless Config.configured?

        :live
      end
    end
  end
end