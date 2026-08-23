# frozen_string_literal: true

namespace :session_snapshots do
  desc "Delete proctoring snapshots past their UU PDP retention period (schedule this daily)"
  task purge_expired: :environment do
    count = SessionSnapshot.purge_expired!
    puts "Purged #{count} expired session snapshot(s)"
  end
end
