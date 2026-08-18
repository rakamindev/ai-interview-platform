# frozen_string_literal: true

class ResumptionTokenWriterWorker
  include Sidekiq::Worker

  sidekiq_options queue: :transcripts, retry: 3

  def perform(session_id, token)
    session = Session.find(session_id)
    session.update_column(:gemini_resumption_token, token)
  rescue ActiveRecord::RecordNotFound
    Rails.logger.warn("[ResumptionTokenWriter] Session #{session_id} not found — skipping")
  end
end
