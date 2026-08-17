# frozen_string_literal: true

namespace :retention do
  desc "Purge candidate personal data (name, transcript text) for sessions past their retention window. Intended to run daily via an external scheduler (cron / Heroku Scheduler) — this project has no in-app job scheduler."
  task purge_expired: :environment do
    sessions = Session.unscoped.expired_for_purge
    count = sessions.count

    sessions.find_each do |session|
      session.purge_personal_data!
    end

    Rails.logger.info("[Retention] Purged personal data for #{count} expired session(s)")
    puts "Purged personal data for #{count} expired session(s)"
  end
end
