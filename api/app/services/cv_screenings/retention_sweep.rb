# frozen_string_literal: true

module CvScreenings
  # Purges expired CV attachments and the PII derived from them. Runs unscoped
  # across every tenant on purpose (see Phase 2's backfill rake task for the same
  # pattern) — a retention sweep has to cover everyone, regardless of which
  # tenant's request context (if any) happens to be running it.
  #
  # Only detected_email is nulled here. Nothing else needed: extracted CV text was
  # deliberately never persisted anywhere (DecisionEngine uses it in one in-memory
  # pass and discards it — see Phase 6), and feedback_text contains no PII by
  # construction (FeedbackGenerator only ever sees the vacancy's public
  # requirement text, never the candidate's CV or email) — so unlike the original
  # plan doc's assumption, there is no extracted_text column or verbatim-CV-quoting
  # reasoning jsonb anywhere on this model that also needs scrubbing.
  class RetentionSweep
    def initialize(retention_days: ENV.fetch('CV_RETENTION_DAYS', 90).to_i)
      @retention_days = retention_days
    end

    def call
      expired_entries.find_each do |entry|
        entry.cv_file.purge if entry.cv_file.attached?
        entry.update_columns(detected_email: nil)
      end
    end

    private

    def expired_entries
      CvScreeningEntry.unscoped.where('created_at < ?', @retention_days.days.ago)
    end
  end
end
