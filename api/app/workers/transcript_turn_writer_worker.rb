# frozen_string_literal: true

class TranscriptTurnWriterWorker
  include Sidekiq::Worker

  sidekiq_options queue: :transcripts, retry: 3

  def perform(session_id, turn_number, speaker, text)
    session = Session.find(session_id)
    return if session.ended?

    TranscriptTurn.upsert(
      { session_id: session_id, turn_number: turn_number, speaker: speaker, text: text },
      unique_by: :idx_transcript_session
    )
    CoverageAnalyzerWorker.perform_async(session_id, turn_number) if speaker == 'candidate'
  rescue ActiveRecord::RecordNotFound
    Rails.logger.warn("[TranscriptWriter] Session #{session_id} not found — skipping")
  end
end
