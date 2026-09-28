# frozen_string_literal: true

# Native Windows Puma runs in single mode because Ruby cannot fork there. Start
# EventMachine in the server process; Linux Puma starts it after each worker fork
# in config/puma.rb instead.
server_process = defined?(Rails::Server) || File.basename($PROGRAM_NAME).match?(/\Apuma(?:\.exe)?\z/)

if Gem.win_platform? && server_process && !EventMachine.reactor_running?
  ready = Queue.new
  Thread.new do
    EventMachine.run do
      ready.push(:ok)
      Rails.logger.info("[EM] EventMachine reactor started in process #{Process.pid}")
    end
  end
  ready.pop
end
