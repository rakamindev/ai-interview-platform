# frozen_string_literal: true

# Candidate data deletion (AC-B3). Idempotent: revokes consent, removes the
# transcript and portfolio, and nulls the candidate identity on the session.
# Queued by DELETE /sessions/:token/data.
class CandidateDataDeletionJob
  include Sidekiq::Worker

  sidekiq_options queue: :default, retry: 3

  def perform(session_id)
    session = Session.unscoped.find_by(id: session_id)
    return Rails.logger.warn("[ConsentDeletion] Session #{session_id} not found — skipping") unless session

    ActiveRecord::Base.transaction do
      session.consent&.update!(status: 'revoked', revoked_at: Time.current)
      session.transcript_turns.delete_all
      session.portfolio&.destroy
      session.update!(candidate_name: nil, candidate_id: nil)
    end

    Rails.logger.info("[ConsentDeletion] Data deleted for session #{session_id}")
  end
end