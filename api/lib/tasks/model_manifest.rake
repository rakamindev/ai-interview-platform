# frozen_string_literal: true

require 'net/http'
require 'json'

# Validates the three canonical Gemini models against the live Google API.
# Prints a status table; exits non-zero if any primary model is unavailable.
namespace :model_manifest do
  desc 'Validate configured Gemini models exist on the Google API'
  task validate: :environment do
    key = ENV['GEMINI_API_KEY']

    unless key.present?
      warn 'GEMINI_API_KEY not set — skipping model probe (CI without secrets).'
      exit 0
    end

    expected_methods = {
      'GEMINI_LIVE_MODEL'  => 'bidiGenerateContent',
      'GEMINI_FLASH_MODEL' => 'generateContent',
      'GEMINI_PRO_MODEL'   => 'generateContent'
    }

    # Live-preview models are only listed on /v1beta (v1 returns 404 for them),
    # while flash/pro appear on both with generateContent — probe v1beta uniformly.
    results = Gemini::ModelManifest.catalog.map do |entry|
      name = entry[:name]
      method = expected_methods.fetch(entry[:env_key])
      uri = URI("https://generativelanguage.googleapis.com/v1beta/models/#{name}?key=#{key}")

      begin
        res = Net::HTTP.get_response(uri)
        body = JSON.parse(res.body)
      rescue JSON::ParserError, StandardError => e
        { entry: entry, ok: false, reason: "#{e.class}: #{e.message}" }
      else
        if res.is_a?(Net::HTTPSuccess)
          methods = body.dig('supportedGenerationMethods') || []
          if methods.include?(method)
            { entry: entry, ok: true, reason: 'OK' }
          else
            { entry: entry, ok: false, reason: "missing #{method} (has #{methods.join(', ')})" }
          end
        else
          { entry: entry, ok: false, reason: "HTTP #{res.code}: #{body.dig('error', 'message') || res.body.to_s[0, 120]}" }
        end
      end
    end

    puts format('%-24s %-40s %-6s %s', 'ENV KEY', 'MODEL', 'STATUS', 'REASON')
    puts '-' * 90

    results.each do |r|
      env_key, name, status, reason = r[:entry][:env_key], r[:entry][:name], r[:ok] ? 'OK' : 'WARNING', r[:reason]
      puts format('%-24s %-40s %-6s %s', env_key, name, status, reason)
    end

    failed = results.reject { |r| r[:ok] }
    exit 1 if failed.any?
  end
end