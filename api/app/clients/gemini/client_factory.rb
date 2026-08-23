# frozen_string_literal: true

module Gemini
  # Single place that decides HttpClient vs StubClient so GEMINI_STUB actually
  # takes effect. Previously every caller instantiated HttpClient directly,
  # so GEMINI_STUB=true (the documented dev/demo default in .env and
  # docker-compose.yml) had no effect and every request hit the real API.
  module ClientFactory
    def self.build(model:, timeout: 60)
      if ENV["GEMINI_STUB"] == "true"
        StubClient.new(model: model, timeout: timeout)
      else
        HttpClient.new(model: model, timeout: timeout)
      end
    end
  end
end
