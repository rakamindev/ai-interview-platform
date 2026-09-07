# frozen_string_literal: true

module Sessions
  # Executes compliance-driven data retention cleanup:
  # 1. Permanently deletes biometric text/transcripts (transcript_turns).
  # 2. Anonymizes candidate PII (candidate_name, consent IP, consent User-Agent).
  # 3. Records `anonymized_at` timestamp as auditable proof of destruction.
  # 4. Preserves high-level competency scores for company benchmarking without PII linkage.
  class DataRetentionPurger
    DEFAULT_RETENTION_DAYS = 30

    def self.purge_all_expired!(days: DEFAULT_RETENTION_DAYS)
      scope = Session.unscoped.retention_expired(days)
      total = scope.count
      purged_count = 0

      Rails.logger.info("[DataRetention] Starting batch retention purge for sessions older than #{days} days (#{total} pending)")

      scope.find_each do |session|
        new(session).call
        purged_count += 1
      end

      Rails.logger.info("[DataRetention] Batch retention purge complete. Total purged: #{purged_count}/#{total}")
      { total_found: total, total_purged: purged_count }
    end

    def initialize(session)
      @session = session
    end

    def call
      ActiveRecord::Base.transaction do
        deleted_turns = @session.transcript_turns.delete_all

        @session.update!(
          candidate_name:     "Anonymized Candidate",
          consent_ip_address: nil,
          consent_user_agent: nil,
          anonymized_at:      Time.current
        )

        Rails.logger.info("[DataRetention] Purged session #{@session.id}: removed #{deleted_turns} transcript turns, cleared PII, anonymized_at=#{@session.anonymized_at}")
      end

      @session
    end
  end
end
