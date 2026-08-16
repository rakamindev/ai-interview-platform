# frozen_string_literal: true

# faye-websocket requires EventMachine to be running for its callbacks to fire.
# Puma does not start EM automatically, so we start it in a supervised background
# thread and restart the reactor if it ever stops.
module EmReactor
  def self.start!
    return if EventMachine.reactor_running?

    ready = Queue.new
    Thread.new do
      EventMachine.run do
        EventMachine.error_handler do |error|
          Rails.logger.error(
            "[EM] Uncaught reactor error: #{error.class}: #{error.message}\n" \
            "#{Array(error.backtrace).first(5).join("\n")}"
          )
        end
        ready.push(:ok)
        Rails.logger.info('[EM] EventMachine reactor started')
      end
      Rails.logger.warn('[EM] EventMachine reactor stopped')
    end
    ready.pop
  end

  def self.supervise!
    Thread.new do
      loop do
        sleep 5
        next if EventMachine.reactor_running?

        Rails.logger.error('[EM] reactor not running — restarting')
        start!
      end
    end
  end
end

EmReactor.start!
EmReactor.supervise!
