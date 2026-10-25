# frozen_string_literal: true

module Gemini
  module ModelManifest
    MODELS = [
      ENV.fetch('GEMINI_LIVE_MODEL'),
      ENV.fetch('GEMINI_FLASH_MODEL'),
      ENV.fetch('GEMINI_PRO_MODEL')
    ].freeze

    def self.catalog
      [
        { name: ENV['GEMINI_LIVE_MODEL'], env_key: 'GEMINI_LIVE_MODEL' },
        { name: ENV['GEMINI_FLASH_MODEL'], env_key: 'GEMINI_FLASH_MODEL' },
        { name: ENV['GEMINI_PRO_MODEL'],  env_key: 'GEMINI_PRO_MODEL'  }
      ].freeze
    end
  end
end