# frozen_string_literal: true

require 'socket'
require 'openssl'
require 'websocket/driver'
require 'uri'

module Gemini
  class SslWebSocketClient
    MessageEvent = Struct.new(:data)
    CloseEvent   = Struct.new(:code, :reason)
    ErrorEvent   = Struct.new(:message)

    attr_reader :url, :ready_state

    def initialize(url, _protocols = nil, headers: {})
      @url = url
      @headers = headers || {}
      @callbacks = {}
      @write_mutex = Mutex.new
      @closed = false
      @ready_state = 0 # 0: CONNECTING, 1: OPEN, 2: CLOSING, 3: CLOSED

      # Connect in background thread so caller can attach event listeners (.on(:open), etc.) first
      Thread.new { connect_and_listen }
    end

    def on(event, &block)
      @callbacks[event.to_sym] = block
    end

    def send(data)
      return false if @closed || @ready_state != 1

      @write_mutex.synchronize do
        if data.is_a?(String)
          @driver.text(data)
        else
          @driver.binary(data)
        end
      end
      true
    rescue StandardError => e
      trigger(:error, ErrorEvent.new(e.message))
      false
    end

    def close(code = 1000, reason = '')
      return if @closed
      @closed = true
      @ready_state = 2

      @write_mutex.synchronize do
        @driver&.close(reason, code)
      end rescue nil

      cleanup_socket
      @ready_state = 3
    end

    private

    def connect_and_listen
      # Brief pause to allow the caller to finish registering .on(:open) / .on(:message) handlers
      sleep 0.01

      uri = URI.parse(@url)
      port = uri.port || 443

      tcp = TCPSocket.new(uri.host, port)
      ctx = OpenSSL::SSL::SSLContext.new
      @ssl = OpenSSL::SSL::SSLSocket.new(tcp, ctx)
      @ssl.hostname = uri.host
      @ssl.sync_close = true
      @ssl.connect
      @ssl.sync = true

      io = SocketIO.new(@url, @ssl)
      @driver = WebSocket::Driver.client(io)

      @headers.each do |k, v|
        @driver.set_header(k.to_s, v.to_s)
      end

      setup_driver_events
      @driver.start

      read_loop
    rescue StandardError => e
      Rails.logger.error("[SslWebSocketClient] Connection failed: #{e.class}: #{e.message}") if defined?(Rails)
      @ready_state = 3
      @closed = true
      trigger(:error, ErrorEvent.new(e.message))
      trigger(:close, CloseEvent.new(1006, e.message))
      cleanup_socket
    end

    def setup_driver_events
      @driver.on(:open) do
        @ready_state = 1
        trigger(:open, nil)
      end

      @driver.on(:message) do |event|
        trigger(:message, MessageEvent.new(event.data))
      end

      @driver.on(:close) do |event|
        @ready_state = 3
        @closed = true
        trigger(:close, CloseEvent.new(event.code || 1000, event.reason.to_s))
        cleanup_socket
      end

      @driver.on(:error) do |event|
        trigger(:error, ErrorEvent.new(event.message.to_s))
      end
    end

    def read_loop
      loop do
        break if @closed || !@ssl

        begin
          chunk = @ssl.read_nonblock(16384)
          @driver.parse(chunk)
        rescue IO::WaitReadable
          IO.select([@ssl], nil, nil, 0.2)
        rescue IO::WaitWritable
          IO.select(nil, [@ssl], nil, 0.2)
        rescue EOFError, Errno::ECONNRESET, OpenSSL::SSL::SSLError => e
          unless @closed
            @ready_state = 3
            @closed = true
            trigger(:close, CloseEvent.new(1006, e.message))
          end
          break
        rescue StandardError => e
          trigger(:error, ErrorEvent.new(e.message)) unless @closed
          break
        end
      end
    ensure
      cleanup_socket
    end

    def trigger(event, event_obj)
      cb = @callbacks[event.to_sym]
      return unless cb

      if defined?(EM) && EM.reactor_running?
        EM.next_tick { cb.call(event_obj) }
      else
        cb.call(event_obj)
      end
    rescue StandardError => e
      Rails.logger.error("[SslWebSocketClient] Callback error for #{event}: #{e.message}") if defined?(Rails)
    end

    def cleanup_socket
      @write_mutex.synchronize do
        @ssl&.close rescue nil
        @ssl = nil
      end
    end

    class SocketIO
      attr_reader :url

      def initialize(url, ssl)
        @url = url
        @ssl = ssl
      end

      def write(data)
        return unless @ssl

        bytes = @ssl.write(data)
        @ssl.flush if @ssl.respond_to?(:flush)
        bytes
      rescue StandardError => e
        # Socket might be closing
      end
    end
  end
end
