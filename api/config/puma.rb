# frozen_string_literal: true

ENV['OBJC_DISABLE_INITIALIZE_FORK_SAFETY'] ||= 'YES' if RUBY_PLATFORM =~ /darwin/

# Each active interview occupies 1 Puma thread (audio WebSocket + Gemini WS).
# With 16 threads and 2 workers (32 total), the server handles ~10 concurrent interviews
# plus REST API headroom.
max_threads_count = ENV.fetch('RAILS_MAX_THREADS', 16)
min_threads_count = ENV.fetch('RAILS_MIN_THREADS') { max_threads_count }
threads min_threads_count, max_threads_count

# In development on macOS/local dev, default to single mode (workers: 0) to eliminate
# multi-process fork crashes and objc_initializeAfterForkError.
# Clustered mode is used in production or when WEB_CONCURRENCY is explicitly configured > 0.
worker_count = ENV.fetch('WEB_CONCURRENCY') { ENV['RAILS_ENV'] == 'production' ? 2 : 0 }.to_i
if worker_count > 0
  workers worker_count
  preload_app!
end

worker_timeout 3600 if ENV.fetch('RAILS_ENV', 'development') == 'development'

# Keep long-lived WebSocket connections alive between Puma keep-alive checks.
# Interviews run 30-90 minutes — connections must not time out.
persistent_timeout ENV.fetch('PUMA_PERSISTENT_TIMEOUT', 300).to_i
first_data_timeout ENV.fetch('PUMA_FIRST_DATA_TIMEOUT', 30).to_i

port ENV.fetch('PORT', 3001)

environment ENV.fetch('RAILS_ENV', 'development')

pidfile ENV.fetch('PIDFILE', 'tmp/pids/server.pid')

if worker_count > 0
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
