# frozen_string_literal: true

# Gemini connectivity and configuration tasks.
#
#   rake gemini:diagnostics  - print the effective configuration (no secrets)
#   rake gemini:check        - make one real generateContent call
#   rake gemini:models       - list the models this API key can call
#
# All three exit 0 when the deployment is deliberately configured that way
# (disabled, or mock in development) and exit 1 when AI is expected to work
# but cannot, so they are usable as smoke tests in CI or after a deploy.
namespace :gemini do
  def gemini_puts(line)
    puts line
  end

  def gemini_header(title)
    gemini_puts "\n=== #{title} ==="
  end

  def gemini_diagnostics
    Gemini::Config.diagnostics.each do |key, value|
      rendered = value.is_a?(Hash) ? value.map { |k, v| "#{k}=#{v}" }.join(' ') : value
      gemini_puts format('  %-16s %s', key, rendered)
    end
    gemini_puts format('  %-16s %s', 'client', Gemini::Factory.mode)
  end

  def gemini_abort(message)
    gemini_puts "FAIL: #{message}"
    # exit, not abort: a bare abort inside a Rake rescue re-prints the
    # rescued exception's backtrace to stderr.
    exit 1
  end

  desc 'Print the effective Gemini configuration (never prints the API key)'
  task diagnostics: :environment do
    gemini_header('Gemini configuration')
    gemini_diagnostics
    gemini_puts "\nRun rake gemini:check to exercise a live call."
  end

  desc 'Make one generateContent call and verify the response parses'
  task check: :environment do
    gemini_header('Gemini connectivity check')
    gemini_diagnostics

    case Gemini::Factory.mode
    when :disabled
      gemini_puts "\nOK: GEMINI_ENABLED=false — AI features are intentionally off in this deployment."
    when :mock
      # Exercises the same call path the app uses, without the network.
      client = Gemini::Factory.client(role: :check)
      result = client.generate_content('Reply with the single JSON object {"ok":true}.')
      gemini_abort("mock client returned #{result.class}, expected a Hash") unless result.is_a?(Hash)

      gemini_puts "\nOK: mock mode — client wiring works; no network call was made."
      gemini_puts '      Set GEMINI_API_KEY to check the real endpoint.'
    when :unconfigured
      gemini_abort('GEMINI_ENABLED is true but GEMINI_API_KEY is missing in this deployment.')
    else
      client = Gemini::Factory.client(role: :check)
      started = Process.clock_gettime(Process::CLOCK_MONOTONIC)
      begin
        result = client.generate_content('Reply with the single JSON object {"ok":true}.')
      rescue Gemini::Errors::Error => e
        latency = ((Process.clock_gettime(Process::CLOCK_MONOTONIC) - started) * 1000).round
        gemini_abort("#{e.class} after #{latency}ms: #{e.message}")
      end

      latency = ((Process.clock_gettime(Process::CLOCK_MONOTONIC) - started) * 1000).round
      gemini_abort("response was #{result.class}, expected a Hash") unless result.is_a?(Hash)

      gemini_puts "\nOK: #{Gemini::Config.model(:flash)} answered in #{latency}ms (#{result.inspect})"
    end
  end

  desc 'List the models this API key can call'
  task models: :environment do
    gemini_header('Gemini models available to this key')

    unless Gemini::Config.enabled?
      gemini_abort('GEMINI_ENABLED=false — turn it on to query the API.')
    end
    gemini_abort('GEMINI_API_KEY is missing; cannot list models.') unless Gemini::Config.configured?

    require 'faraday'
    connection = Faraday.new(url: 'https://generativelanguage.googleapis.com/v1') do |f|
      f.options.open_timeout = 10
      f.options.timeout = 30
      f.adapter Faraday.default_adapter
    end

    # Relative path: Faraday merges it onto the /v1 base. An absolute
    # "/models" would discard /v1, request https://host/models, and 404.
    response = connection.get('models') do |request|
      request.headers['x-goog-api-key'] = Gemini::Config.api_key
    end

    unless response.success?
      gemini_abort("models.list returned HTTP #{response.status} " \
                   "(#{response.to_s.bytesize} bytes). Check the key and its API access.")
    end

    payload = begin
      JSON.parse(response.body)
    rescue JSON::ParserError
      gemini_abort('models.list returned a body that is not JSON.')
    end

    models = Array(payload['models'])
            .select { |model| model['name'].to_s.include?('gemini') }
            .select { |model| Array(model['supportedGenerationMethods']).include?('generateContent') }
            .map { |model| model['name'].sub('models/', '') }
            .sort

    gemini_abort('This key can call no generateContent models.') if models.empty?

    models.each { |name| gemini_puts "  #{name}" }
    gemini_puts "\nCurrent defaults: #{Gemini::Config.diagnostics[:models].inspect}"
    gemini_puts '  (live is a WebSocket model and is not listed by this API.)'
  end
end