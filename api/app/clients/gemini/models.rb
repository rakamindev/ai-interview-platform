# frozen_string_literal: true

module Gemini
  # The Gemini model names, in one place. Each one can be changed with an
  # env var. Google retires model names over time, so check which ones your
  # API key can use (see api/README.md) before changing them.
  module Models
    DEFAULTS = {
      live: 'gemini-3.1-flash-live-preview', # the voice interview
      flash: 'gemini-2.5-flash',             # coverage analysis and fit/gap notes
      pro: 'gemini-3.6-flash'                # the final skill report
    }.freeze

    def self.live
      ENV['GEMINI_LIVE_MODEL'].presence || DEFAULTS[:live]
    end

    def self.flash
      ENV['GEMINI_FLASH_MODEL'].presence || DEFAULTS[:flash]
    end

    def self.pro
      ENV['GEMINI_PRO_MODEL'].presence || DEFAULTS[:pro]
    end
  end
end
