# frozen_string_literal: true

module Portfolios
  # Skips a second portfolio generation while the first is still inside
  # its expected runtime. A stale "generating" row is allowed through so a
  # crashed worker cannot block the session forever.
  module GenerationGuard
    STALE_AFTER_SECONDS = 600

    module_function

    def skip?(status:, started_at:, now: Time.now, stale_after: STALE_AFTER_SECONDS)
      return false unless status.to_s == 'generating'
      return false if started_at.nil?

      (now - started_at) < stale_after
    end
  end
end
