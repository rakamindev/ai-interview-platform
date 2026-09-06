# frozen_string_literal: true

module Sessions
  # The public invite-token endpoint is retryable, but it must not end a live
  # interview before the server has reached its natural completion point.
  class CompletionGate
    def self.allowed?(session)
      session.active? && !session.completion_authorized_at.nil?
    end
  end
end
