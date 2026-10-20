# frozen_string_literal: true

# faye-websocket requires EventMachine to be running for its callbacks to fire.
# Puma does not start EM automatically, so we start it in a background thread.
#
# The test suite must never boot the reactor: a live reactor keeps the RSpec
# process alive and prevents a clean exit. WebSocket behaviour is covered with
# explicit doubles instead.
unless Rails.env.test? || EventMachine.reactor_running?
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
