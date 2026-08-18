# frozen_string_literal: true

# faye-websocket needs a running EventMachine reactor. Starting the reactor in a
# process that later fork()s (the clustered-Puma master under preload_app!) is NOT
# fork-safe and wedges the workers — so under clustered Puma the reactor is started
# per worker in config/puma.rb (on_worker_boot). This initializer only starts it for
# single-process servers (Puma with WEB_CONCURRENCY=0, other app servers).
module EmReactor
  MUTEX = Mutex.new

  # Idempotent, self-healing: if the reactor ever stops it is restarted.
  def self.start!
    MUTEX.synchronize do
      return if EventMachine.reactor_running?

      ready = Queue.new
      Thread.new do
        signalled = false
        loop do
          begin
            EventMachine.run do
              EventMachine.error_handler do |error|
                Rails.logger.error("[EM] Uncaught reactor error: #{error.class}: #{error.message}")
              end
              unless signalled
                ready.push(:ok)
                signalled = true
              end
              Rails.logger.info('[EM] EventMachine reactor started')
            end
          rescue StandardError => e
            Rails.logger.error("[EM] reactor crashed: #{e.class}: #{e.message}")
          ensure
            # Never let boot block forever if the reactor fails to come up.
            unless signalled
              ready.push(:ok)
              signalled = true
            end
          end
          Rails.logger.warn('[EM] reactor stopped — restarting in 1s')
          sleep 1
        end
      end
      ready.pop
    end
  end
end

running_server = defined?(Rails::Server) || defined?(Puma)
clustered_puma = defined?(Puma) && ENV.fetch('WEB_CONCURRENCY', 2).to_i.positive?
EmReactor.start! if running_server && !clustered_puma
