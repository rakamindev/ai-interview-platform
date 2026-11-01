# frozen_string_literal: true

# Ends an interview whose candidate did not rejoin within the reconnect grace period. Runs in Sidekiq
# so the deadline survives a web restart and can be scheduled from REST and socket code alike.
class SessionGraceEndWorker
  include Sidekiq::Worker

  sidekiq_options retry: 5

  def perform(session_id, connection_token)
    session = Session.unscoped.find_by(id: session_id)
    return unless session&.active?
    return unless Sessions::ClientClaim.new(session).finalize(connection_token)

    Rails.logger.info("[SessionGraceEnd] Grace period expired — ending session #{session.id}")
    Sessions::EndHandler.new(session).call(reason: 'error')
  end
end
