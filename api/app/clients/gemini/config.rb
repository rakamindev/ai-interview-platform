# frozen_string_literal: true

module Gemini
  # Single source of truth for every Gemini setting in the app.
  #
  # Nothing in here ever exposes a secret: +diagnostics+ is safe to print, log
  # or hand to an admin screen, and the API key is never included in it.
  #
  # Environment variables (all optional unless noted):
  #   GEMINI_API_KEY        *secret*  - Google AI Studio API key
  #   GEMINI_ENABLED        default true. false turns every AI feature off.
  #   GEMINI_MOCK_MODE      default auto (see +mock?+)
  #   GEMINI_LIVE_MODEL     default gemini-3.8-live
  #   GEMINI_FLASH_MODEL    default gemini-3.6-flash
  #   GEMINI_PRO_MODEL      default gemini-3.6-flash
  #   GEMINI_TIMEOUT_<ROLE> default per role: 45/30/180 (see ROLE_DEFAULTS)
  #   GEMINI_TIMEOUT_OPEN_S default 10   (connection open timeout, seconds)
  #   GEMINI_MAX_RETRY_WAIT default 10   (cap for a single backoff sleep, seconds)
  module Config
    # Model ids current as of 2026-10. Older ids are shut down or restricted:
    #   gemini-2.0-flash-001            shut down 2026-06-01
    #   gemini-2.0-pro-001              never existed as a GA API model
    #   gemini-2.0-flash-live-001        shut down 2025-12-09
    #   gemini-3.1-flash-live-preview    shutdown 2026-11-17
    # Source: https://ai.google.dev/gemini-api/docs/deprecations
    #
    # gemini-3.8-flash is a current, documented id, but on 2026-10-27 it
    # returned only timeouts and HTTP 503 UNAVAILABLE for this key while
    # gemini-3.6-flash answered in ~4s. Ship the model that works, keep the
    # id overridable, and revisit when 3.8 capacity lands.
    MODELS = {
      live:  { env: 'GEMINI_LIVE_MODEL',  default: 'gemini-3.8-live' },
      flash: { env: 'GEMINI_FLASH_MODEL', default: 'gemini-3.6-flash' },
      pro:   { env: 'GEMINI_PRO_MODEL',   default: 'gemini-3.6-flash' }
    }.freeze

    # One vocabulary for callers: a call-site role maps to a model, a timeout
    # and a retry budget matched to that call site's risk profile.
    #
    # retry_wait caps a single Faraday backoff (including a Retry-After
    # header); retries are deliberately short because Sidekiq already owns
    # long-horizon backoff for the integration points.
    ROLE_DEFAULTS = {
      analysis:   { model: :flash, timeout: 45,  retry_max: 2, retry_wait: 3 },  # per-turn coverage, background
      narrative:  { model: :flash, timeout: 30,  retry_max: 2, retry_wait: 5 },  # fit/gap narrative, background
      portfolio:  { model: :pro,   timeout: 180, retry_max: 1, retry_wait: 10 }, # full transcript, long
      check:      { model: :flash, timeout: 30,  retry_max: 1, retry_wait: 5 },  # connectivity smoke test
      live:       { model: :live,  timeout: nil, retry_max: nil, retry_wait: nil } # WebSocket, LiveClient owns it
    }.freeze

    OPEN_TIMEOUT   = 10
    MAX_RETRY_WAIT = 10

    class << self
      # Master switch. Turning this off makes every AI feature fail loudly and
      # cheaply at call time instead of returning nothing silently.
      def enabled?
        !%w[false 0 no off].include?(ENV.fetch('GEMINI_ENABLED', 'true').to_s.strip.downcase)
      end

      def api_key
        ENV.fetch('GEMINI_API_KEY', nil).to_s.strip.presence
      end

      # A real Google AI Studio key is a 39-character AIza… string. Anything
      # shorter, or shaped like a template value, is treated as "not
      # configured" so a fresh clone (or a placeholder in a demo deploy) runs
      # on the mock client instead of hammering Google with a fake key.
      PLACEHOLDER_KEY = /\A(?:your[_-]|changeme|dummy|placeholder|xxx+|test[_-]?key|<)/i.freeze

      # :set, :placeholder or :missing.
      def key_state
        key = api_key
        return :missing if key.nil?
        return :placeholder if key.length < 30 || PLACEHOLDER_KEY.match?(key)

        :set
      end

      def configured?
        key_state == :set
      end

      # Production-grade environments must never fall through to the mock.
      def strict_env?
        %w[production staging].include?(ENV.fetch('RAILS_ENV', 'development'))
      end

      # Mock is used when:
      #   1. explicitly requested (GEMINI_MOCK_MODE=true), or
      #   2. the test suite is running (never call the real API from CI), or
      #   3. no usable key outside production/staging, so local dev and a
      #      developer without a Google account still boot and behave sanely.
      # In production/staging a missing or placeholder key is NOT mocked: the
      # boot check turns it into a deploy-time failure instead.
      def mock?
        return true  if truthy?(ENV['GEMINI_MOCK_MODE'])
        return false if truthy?(ENV['GEMINI_FORCE_LIVE']) # escape hatch for a live smoke test
        return true  if ENV['RAILS_ENV'] == 'test'
        return false if configured?
        return true  unless strict_env?

        false
      end

      # Model id for a model role (:live, :flash, :pro).
      def model(role)
        entry = MODELS.fetch(role) do
          raise ArgumentError, "Unknown Gemini model role: #{role.inspect} (expected #{MODELS.keys.join(', ')})"
        end
        ENV.fetch(entry[:env], entry[:default]).presence || entry[:default]
      end

      # Resolves a call-site role to { model:, timeout:, retry_max:, retry_wait: }.
      # Each numeric field can be overridden by GEMINI_<FIELD>_<ROLE>, e.g.
      # GEMINI_TIMEOUT_PORTFOLIO, GEMINI_RETRY_MAX_ANALYSIS.
      def by_role(role)
        defaults = ROLE_DEFAULTS.fetch(role) do
          raise ArgumentError, "Unknown Gemini role: #{role.inspect} (expected #{ROLE_DEFAULTS.keys.join(', ')})"
        end

        {
          model:      model(defaults[:model]),
          timeout:    env_or("GEMINI_TIMEOUT_#{role.to_s.upcase}", defaults[:timeout]),
          retry_max:  env_or("GEMINI_RETRY_MAX_#{role.to_s.upcase}", defaults[:retry_max]),
          retry_wait: env_or("GEMINI_RETRY_WAIT_#{role.to_s.upcase}", defaults[:retry_wait])
        }
      end

      # True when AI is expected to run but cannot be called.
      def broken?
        !enabled? || (!configured? && !mock?)
      end

      def open_timeout
        ENV.fetch('GEMINI_TIMEOUT_OPEN_S', OPEN_TIMEOUT).to_i.clamp(1, 120)
      end

      def max_retry_wait
        ENV.fetch('GEMINI_MAX_RETRY_WAIT', MAX_RETRY_WAIT).to_i.clamp(1, 60)
      end

      # Never prints the key and never prints prompt content. Safe for logs,
      # rake output and an admin-facing diagnostics screen.
      def diagnostics
        {
          enabled: enabled?,
          mock_mode: mock?,
          api_key: case key_state
                   when :set         then 'set'
                   when :placeholder then 'placeholder (treated as not configured)'
                   else 'missing'
                   end,
          base_url: 'https://generativelanguage.googleapis.com/v1',
          models: MODELS.keys.index_with { |role| model(role) },
          roles: ROLE_DEFAULTS.keys.index_with { |role| by_role(role) },
          open_timeout_s: open_timeout,
          max_retry_wait_s: max_retry_wait,
          env: ENV.fetch('RAILS_ENV', 'development')
        }
      end

      # Failure messages end up in portfolios.generation_error, so they must
      # never carry prompt text, candidate answers or the API key.
      def safe_message(error, limit: 300)
        text = error.is_a?(Exception) ? "#{error.class}: #{error.message}" : error.to_s
        text = text.gsub(/\s+/, ' ').strip
        text.length > limit ? "#{text[0, limit]}…" : text
      end

      private

      # Numeric override from the environment, falling back to the role default.
      def env_or(name, default)
        value = ENV[name].to_s.strip
        return default if value.empty?

        value.to_i
      end

      def truthy?(value)
        %w[true 1 yes on].include?(value.to_s.strip.downcase)
      end
    end
  end
end