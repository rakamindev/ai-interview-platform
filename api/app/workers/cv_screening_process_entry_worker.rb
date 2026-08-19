# frozen_string_literal: true

# One job per CV screening entry. Arguments are the entry id ONLY — never text,
# email, or filename, because Sidekiq logs job args on error and keeps full
# payloads in the retry and dead sets.
class CvScreeningProcessEntryWorker
  include Sidekiq::Worker

  sidekiq_options queue: :default, retry: 3

  sidekiq_retries_exhausted do |msg, _ex|
    entry_id = msg['args'].first
    entry = CvScreeningEntry.unscoped.find_by(id: entry_id)
    if entry
      entry.update(decision: 'needs_review', decision_reason: 'model_failed')
      # This entry won't be emailed (needs_review never is), but it leaving
      # 'pending' may be what makes the rest of the batch ready to evaluate.
      CvScreenings::BatchNotifier.new(entry.cv_screening_batch).evaluate_after_entry_decision
    end
    Rails.logger.error(
      "[CvScreeningProcessEntryWorker] entry_id=#{entry_id} retries exhausted — pipeline failure " \
      "(NOT a model/Gemini call): #{msg['error_class']}: #{msg['error_message']}"
    )
  end

  def perform(entry_id)
    entry = CvScreeningEntry.unscoped.find_by(id: entry_id)
    return Rails.logger.warn("[CvScreeningProcessEntryWorker] entry #{entry_id} not found — skipping") unless entry

    # Idempotent: an entry already past 'pending' has already been through the
    # pipeline (or resolved by a human) — never reprocess it automatically.
    return unless entry.pending?

    # RequestStore is empty inside Sidekiq — re-assert tenancy from the persisted
    # row rather than trusting any ambient state.
    Current.tenant_id = entry.tenant_id

    CvScreenings::DecisionEngine.new(entry: entry).call
    CvScreenings::BatchNotifier.new(entry.cv_screening_batch).evaluate_after_entry_decision
  rescue StandardError => e
    Rails.logger.error(
      "[CvScreeningProcessEntryWorker] entry_id=#{entry_id} pipeline failure (NOT a model/Gemini " \
      "call — those are caught separately upstream): #{e.class}: #{e.message}"
    )
    raise
  ensure
    Current.clear
  end
end
