# frozen_string_literal: true

# Single resolution point for "which Gemini client should this service use?".
#
# Every AI-dependent service already accepted an injectable `gemini_client:` —
# the seam existed and was never used, which is why nothing in this codebase
# could run or be tested without a live vendor key. This factory activates it.
#
# Resolution order:
#   1. GEMINI_STUB=true            → stub (explicit opt-in, used by the test suite)
#   2. GEMINI_API_KEY blank/"stub" → stub (local dev without a key)
#   3. otherwise                   → the real HTTP client
#
# Production is never allowed to resolve to the stub: silently serving fabricated
# assessments to real candidates is a far worse failure than refusing to boot.
module Gemini
  STUB_SENTINELS = ['', 'stub', 'fake', 'none'].freeze

  class StubClientInProductionError < StandardError; end

  def self.client_for(model:, timeout: 60)
    if stub?
      raise StubClientInProductionError, 'Refusing to serve stubbed AI output in production' if Rails.env.production?

      return StubClient.new(model: model, timeout: timeout)
    end

    HttpClient.new(model: model, timeout: timeout)
  end

  def self.stub?
    return true if ENV['GEMINI_STUB'].to_s.downcase == 'true'

    STUB_SENTINELS.include?(ENV['GEMINI_API_KEY'].to_s.strip.downcase)
  end
end
