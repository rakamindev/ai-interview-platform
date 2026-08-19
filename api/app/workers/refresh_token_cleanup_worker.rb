# frozen_string_literal: true

class RefreshTokenCleanupWorker
  include Sidekiq::Worker

  sidekiq_options queue: :default, retry: 3

  def perform
    expired_count = RefreshToken.expired.delete_all
    revoked_count = RefreshToken.revoked.where("revoked_at < ?", 7.days.ago).delete_all

    Rails.logger.info("[RefreshTokenCleanup] Removed #{expired_count} expired, #{revoked_count} revoked tokens")
  rescue StandardError => e
    Rails.logger.error("[RefreshTokenCleanup] Failed: #{e.class} #{e.message}")
    raise
  end
end
