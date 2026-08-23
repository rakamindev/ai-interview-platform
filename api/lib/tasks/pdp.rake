# frozen_string_literal: true

# UU PDP data-retention support.
#
# Interview data (sessions + transcripts + portfolios + fit/gap reports) is
# personal data and must not be retained indefinitely.
#
# Usage:
#   bundle exec rails pdp:purge_expired                     # purge > 90 days
#   PDP_RETENTION_DAYS=30 rails pdp:purge_expired           # custom window
#   PDP_RETENTION_DAYS=0 rails pdp:purge_expired            # disabled (no-op)
#
# Schedule via k8s CronJob / crontab, e.g. daily at 03:00:
#   0 3 * * * cd /app && bundle exec rails pdp:purge_expired
namespace :pdp do
  desc 'Purge ended interview sessions older than PDP_RETENTION_DAYS (default 90)'
  task purge_expired: :environment do
    days = ENV.fetch('PDP_RETENTION_DAYS', '90').to_i
    if days <= 0
      puts 'PDP retention disabled (PDP_RETENTION_DAYS <= 0) — nothing to do.'
      next
    end

    cutoff = days.days.ago
    # Only ENDED sessions are ever purged — never touch live interviews.
    scope = Session.unscoped.ended.where(ended_at: ...cutoff)

    total = scope.count
    next puts "No sessions ended before #{cutoff.strftime('%Y-%m-%d')} — nothing to purge." if total.zero?

    purged = 0
    scope.in_batches(of: 100) do |batch|
      purged += batch.destroy_all.size
    end

    Assessment.bump_cache_version

    message = "[PDP] Purged #{purged}/#{total} sessions that ended before #{cutoff.strftime('%Y-%m-%d')}"
    puts message
    Rails.logger.info(message)
  end
end
