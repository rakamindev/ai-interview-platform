# frozen_string_literal: true

class InvitationSenderWorker
  include Sidekiq::Worker

  sidekiq_options queue: :mailers, retry: 3

  sidekiq_retries_exhausted do |msg, _ex|
    session_id = msg['args'].first
    session = Session.find_by(id: session_id)
    # Only now — after all retries are exhausted — do we mark the invitation as permanently failed.
    session&.update(
      invitation_status: 'failed',
      invitation_error:  "Failed after #{msg['retry_count']} retries: #{msg['error_message']}"
    )
  end

  def perform(session_id)
    session = Session.find(session_id)
    
    CandidateMailer.with(session: session).invitation_email.deliver_now
    
    session.update!(
      invitation_status: 'sent',
      invitation_sent_at: Time.current,
      invitation_error: nil
    )
  rescue => e
    # Do NOT set invitation_status to 'failed' here. Sidekiq will retry this job up to
    # sidekiq_options retry: times. Setting 'failed' prematurely would misrepresent the
    # state while retries are still pending. Only record the last error for observability;
    # the permanent 'failed' transition happens in sidekiq_retries_exhausted.
    session.update_columns(invitation_error: "Attempt failed: #{e.message}")
    raise e
  end
end
