# frozen_string_literal: true

# Each active interview occupies 1 Puma thread (audio WebSocket + Gemini WS).
max_threads_count = ENV.fetch('RAILS_MAX_THREADS', 16).to_i
min_threads_count = ENV.fetch('RAILS_MIN_THREADS', max_threads_count).to_i

threads min_threads_count, max_threads_count

# Puma cluster/worker mode requires fork(), which is not available on Windows.
# Keep a single process on Windows, but allow multiple workers in production
# on Unix/Linux.
unless Gem.win_platform?
  workers ENV.fetch('WEB_CONCURRENCY', 2).to_i

  preload_app!

  on_worker_boot do
    ActiveRecord::Base.establish_connection if defined?(ActiveRecord)

    # Restart the EventMachine reactor in each forked worker.
    unless EventMachine.reactor_running?
      ready = Queue.new
      Thread.new { EventMachine.run { ready.push(:ok) } }
      ready.pop
    end
  end
end

worker_timeout 3600 if ENV.fetch('RAILS_ENV', 'development') == 'development'

# Keep long-lived WebSocket connections alive between Puma keep-alive checks.
persistent_timeout ENV.fetch('PUMA_PERSISTENT_TIMEOUT', 300).to_i
first_data_timeout ENV.fetch('PUMA_FIRST_DATA_TIMEOUT', 30).to_i

port ENV.fetch('PORT', 3001)

environment ENV.fetch('RAILS_ENV', 'development')

pidfile ENV.fetch('PIDFILE', 'tmp/pids/server.pid')

plugin :tmp_restart