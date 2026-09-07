# frozen_string_literal: true

namespace :data_retention do
  desc "Purge transcripts and anonymize PII for sessions older than retention days (default: 30 days)"
  task :purge_expired, [:days] => :environment do |_t, args|
    days = (args[:days] || ENV['DATA_RETENTION_DAYS'] || 30).to_i
    puts "Starting data retention purge for sessions older than #{days} days..."
    result = Sessions::DataRetentionPurger.purge_all_expired!(days: days)
    puts "Data retention purge complete: #{result[:total_purged]}/#{result[:total_found]} sessions anonymized."
  end

  desc "Purge a specific session on-demand (Right to Erasure / Right to be Forgotten)"
  task :purge_session, [:session_id] => :environment do |_t, args|
    session_id = args[:session_id]
    abort "Error: session_id is required. Usage: rake data_retention:purge_session[123]" unless session_id

    session = Session.unscoped.find_by(id: session_id)
    abort "Error: Session with ID #{session_id} not found." unless session

    Sessions::DataRetentionPurger.new(session).call
    puts "Session ##{session_id} transcripts and PII have been successfully purged."
  end
end
