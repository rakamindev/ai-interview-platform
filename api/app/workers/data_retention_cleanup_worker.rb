# frozen_string_literal: true

class DataRetentionCleanupWorker
  include Sidekiq::Worker

  sidekiq_options queue: :default, retry: 3

  def self.perform_now(*args, **kwargs)
    new.perform(*args, **kwargs)
  end

  # If session_id is provided, performs on-demand purge for that specific session (e.g. Right to Erasure request).
  # If session_id is nil, performs batch purge for all sessions older than retention days (e.g. 30 days).
  def perform(session_id = nil, days: 30)
    if session_id.present?
      session = Session.unscoped.find_by(id: session_id)
      if session
        Sessions::DataRetentionPurger.new(session).call
        Rails.logger.info("[DataRetentionCleanupWorker] On-demand purge completed for session #{session_id}")
      else
        Rails.logger.warn("[DataRetentionCleanupWorker] Session #{session_id} not found — skipping")
      end
    else
      retention_days = days.presence&.to_i || 30
      result = Sessions::DataRetentionPurger.purge_all_expired!(days: retention_days)
      Rails.logger.info("[DataRetentionCleanupWorker] Scheduled purge finished: #{result}")
    end
  end
end

# Alias for ActiveJob / Job convention compatibility
DataRetentionPurgeJob = DataRetentionCleanupWorker
