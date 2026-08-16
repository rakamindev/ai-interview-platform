# frozen_string_literal: true

# Server-side time ceiling watchdog. The WebSocket only checks the ceiling on
# transcription events, so a silent candidate or a stalled model could run past
# the advertised limit forever. Scheduled when a session activates.
class SessionTimeCeilingWorker
  include Sidekiq::Worker

  sidekiq_options queue: :default, retry: 1

  def perform(session_id)
    session = Session.unscoped.find_by(id: session_id)
    return unless session&.active?
    return unless session.started_at && session.assessment.time_limit_min

    elapsed = (Time.current - session.started_at).to_i
    limit   = session.assessment.time_limit_min * 60
    return if elapsed < limit

    Sessions::EndHandler.new(session).call(reason: 'time_ceiling')
  rescue ActiveRecord::RecordNotFound
    nil
  end
end
