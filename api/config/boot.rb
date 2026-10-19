# frozen_string_literal: true

ENV['BUNDLE_GEMFILE'] ||= File.expand_path('../Gemfile', __dir__)

# Disable macOS Objective-C runtime fork safety check to prevent crash on fork()
ENV['OBJC_DISABLE_INITIALIZE_FORK_SAFETY'] ||= 'YES'

require 'bundler/setup' # Set up gems listed in the Gemfile.
require 'coverage' # Ensure Coverage.running? is available for bootsnap on Ruby 3.3
require 'bootsnap/setup' # Speed up boot time by caching expensive operations.
