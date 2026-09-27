# frozen_string_literal: true

namespace :sessions do
  desc 'End active sessions that are past their deadline (for sessions orphaned by a restart)'
  task end_overdue: :environment do
    ended_ids = SessionDeadlineWorker.end_overdue_sessions
    puts "Ended #{ended_ids.size} overdue session(s)#{": #{ended_ids.join(', ')}" if ended_ids.any?}"
  end
end
