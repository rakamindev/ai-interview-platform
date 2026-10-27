# frozen_string_literal: true

ENV['BUNDLE_GEMFILE'] ||= File.expand_path('../Gemfile', __dir__)

# Load .env if present (support both api/.env and root .env)
[File.expand_path('../.env', __dir__), File.expand_path('../../.env', __dir__)].each do |env_path|
  if File.file?(env_path)
    File.readlines(env_path).each do |line|
      line = line.strip
      next if line.empty? || line.start_with?('#')
      k, v = line.split('=', 2)
      next unless k && v
      val = v.strip.gsub(/\A["']|["']\z/, '')
      ENV[k.strip] = val
    end
  end
end

require 'bundler/setup' # Set up gems listed in the Gemfile.
require 'coverage' # Ensure Coverage.running? is available for bootsnap on Ruby 3.3
require 'bootsnap/setup' # Speed up boot time by caching expensive operations.
