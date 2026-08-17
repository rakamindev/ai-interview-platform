# frozen_string_literal: true

# Each active interview occupies 1 Puma thread (audio WebSocket + Gemini WS).
# With 16 threads and 2 workers (32 total), the server handles ~10 concurrent interviews
# plus REST API headroom.
max_threads_count = ENV.fetch('RAILS_MAX_THREADS', 16)
min_threads_count = ENV.fetch('RAILS_MIN_THREADS') { max_threads_count }
threads min_threads_count, max_threads_count

workers ENV.fetch('WEB_CONCURRENCY', 2)

worker_timeout 3600 if ENV.fetch('RAILS_ENV', 'development') == 'development'

# Keep long-lived WebSocket connections alive between Puma keep-alive checks.
# Interviews run 30-90 minutes — connections must not time out.
persistent_timeout ENV.fetch('PUMA_PERSISTENT_TIMEOUT', 300).to_i
first_data_timeout ENV.fetch('PUMA_FIRST_DATA_TIMEOUT', 30).to_i

port ENV.fetch('PORT', 3001)

environment ENV.fetch('RAILS_ENV', 'development')

pidfile ENV.fetch('PIDFILE', 'tmp/pids/server.pid')

preload_app!

on_worker_boot do
  ActiveRecord::Base.establish_connection if defined?(ActiveRecord)

  # Start the EventMachine reactor in each forked worker. Under preload_app! the
  # reactor is intentionally NOT started in the master (fork-unsafe), so each worker
  # starts its own here via the shared, self-healing starter.
  EmReactor.start! if defined?(EmReactor)
end

plugin :tmp_restart
