# frozen_string_literal: true

# faye-websocket requires EventMachine to be running for its callbacks to fire.
# Puma does not start EM automatically, so we start it in a background thread.
#
# Skip this when Puma will fork worker processes (cluster mode — see the
# matching WEB_CONCURRENCY default in config/puma.rb). A thread started here,
# before preload_app! forks, does not survive the fork, but any lock it held
# at that instant is copied into the child as permanently held with nothing
# left to release it — deadlocking the worker on first use. In cluster mode,
# on_worker_boot in config/puma.rb starts EM fresh in each worker instead,
# after the fork has already happened.
default_workers = ENV.fetch('RAILS_ENV', 'development') == 'development' ? 0 : 2
if ENV.fetch('WEB_CONCURRENCY', default_workers).to_i.zero?
  unless EventMachine.reactor_running?
    ready = Queue.new

    Thread.new do
      EventMachine.run do
        ready.push(:ok)
        Rails.logger.info('[EM] EventMachine reactor started')
      end
    end

    # Block until EM is actually running before the server starts accepting connections
    ready.pop
  end
end
