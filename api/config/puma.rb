# frozen_string_literal: true

# Each active interview occupies 1 Puma thread (audio WebSocket + Gemini WS).
# With 16 threads and 2 workers (32 total), the server handles ~10 concurrent interviews
# plus REST API headroom.
max_threads_count = ENV.fetch('RAILS_MAX_THREADS', 16)
min_threads_count = ENV.fetch('RAILS_MIN_THREADS') { max_threads_count }
threads min_threads_count, max_threads_count

# In development, run in single mode (0 workers) by default to avoid macOS fork safety
# crashes, allow debugger attachment, and support fast code reloads.
# In production (e.g. Docker / Linux containers), default to 2 workers.
default_workers = ENV.fetch('RAILS_ENV', 'development') == 'production' ? 2 : 0
workers_count = ENV.fetch('WEB_CONCURRENCY', default_workers).to_i
workers workers_count if workers_count.positive?

worker_timeout 3600 if ENV.fetch('RAILS_ENV', 'development') == 'development'

# Keep long-lived WebSocket connections alive between Puma keep-alive checks.
# Interviews run 30-90 minutes — connections must not time out.
persistent_timeout ENV.fetch('PUMA_PERSISTENT_TIMEOUT', 300).to_i
first_data_timeout ENV.fetch('PUMA_FIRST_DATA_TIMEOUT', 30).to_i

port ENV.fetch('PORT', 3001)

environment ENV.fetch('RAILS_ENV', 'development')

pidfile ENV.fetch('PIDFILE', 'tmp/pids/server.pid')

if workers_count.positive?
  preload_app!

  on_worker_boot do
    ActiveRecord::Base.establish_connection if defined?(ActiveRecord)

    # Restart the EventMachine reactor in each forked worker — preload_app! forks
    # after EM starts in the master, killing the reactor thread in child processes.
    # Without this, all WebSocket connections silently fail in production workers.
    unless EventMachine.reactor_running?
      ready = Queue.new
      Thread.new { EventMachine.run { ready.push(:ok) } }
      ready.pop
    end
  end
end

plugin :tmp_restart
