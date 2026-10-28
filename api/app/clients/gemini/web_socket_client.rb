# frozen_string_literal: true

require 'socket'
require 'openssl'
require 'websocket/driver'
require 'uri'

module Gemini
  # Pure-Ruby SSL WebSocket client using websocket-driver and OpenSSL::SSL::SSLSocket.
  # Drop-in replacement for Faye::WebSocket::Client that works reliably on Windows
  # where EventMachine's native C++ extension is compiled without OpenSSL.
  class WebSocketClient
    OpenEvent    = Struct.new(:type)
    MessageEvent = Struct.new(:data)
    CloseEvent   = Struct.new(:code, :reason)
    ErrorEvent   = Struct.new(:message)

    def self.connect(url, headers: {})
      new(url, headers: headers).tap(&:connect)
    end

    def initialize(url, headers: {})
      @url = url
      @headers = headers
      @callbacks = Hash.new { |h, k| h[k] = [] }
      @closed = false
      @mutex = Mutex.new
    end

    def on(event, &block)
      @callbacks[event.to_sym] << block
    end

    def connect
      uri = URI.parse(@url)
      port = uri.port || (uri.scheme == 'wss' ? 443 : 80)

      tcp = TCPSocket.new(uri.host, port)
      tcp.setsockopt(Socket::IPPROTO_TCP, Socket::TCP_NODELAY, 1)

      if uri.scheme == 'wss'
        ctx = OpenSSL::SSL::SSLContext.new
        ctx.set_params(verify_mode: OpenSSL::SSL::VERIFY_PEER)
        @ssl = OpenSSL::SSL::SSLSocket.new(tcp, ctx)
        @ssl.hostname = uri.host
        @ssl.sync_close = true
        @ssl.connect
        @socket = @ssl
      else
        @socket = tcp
      end

      driver_socket = Class.new do
        attr_reader :url

        def initialize(socket, url)
          @socket = socket
          @url = url
        end

        def write(data)
          @socket.write(data)
        rescue StandardError
          # socket closed or broke
        end
      end.new(@socket, @url)

      @driver = WebSocket::Driver.client(driver_socket)
      @headers.each do |k, v|
        @driver.set_header(k, v)
      end

      @driver.on(:open) do
        dispatch(:open, OpenEvent.new('open'))
      end

      @driver.on(:message) do |event|
        dispatch(:message, MessageEvent.new(event.data))
      end

      @driver.on(:close) do |event|
        @closed = true
        dispatch(:close, CloseEvent.new(event.code || 1000, event.reason || ''))
        close_socket
      end

      @driver.on(:error) do |event|
        dispatch(:error, ErrorEvent.new(event.message))
      end

      @driver.start

      @read_thread = Thread.new do
        while !@closed && @socket && !@socket.closed?
          begin
            data = @socket.readpartial(16384)
            @mutex.synchronize { @driver.parse(data) }
          rescue EOFError, IOError, Errno::ECONNABORTED, Errno::ECONNRESET, OpenSSL::SSL::SSLError
            break
          rescue StandardError => e
            dispatch(:error, ErrorEvent.new(e.message))
            break
          end
        end
        unless @closed
          @closed = true
          dispatch(:close, CloseEvent.new(1006, 'Connection lost'))
          close_socket
        end
      end
      @read_thread.name = "GeminiWS-#{@url.hash.abs % 1000}"
    end

    def send(data)
      return false if @closed || @socket.nil?

      @mutex.synchronize do
        if data.is_a?(String)
          @driver.text(data)
        else
          @driver.binary(data)
        end
      end
      true
    rescue StandardError => e
      dispatch(:error, ErrorEvent.new(e.message))
      false
    end

    def close(code = 1000, reason = '')
      return if @closed

      @closed = true

      @mutex.synchronize do
        begin
          @driver&.close(reason, code)
        rescue StandardError
          nil
        end
      end

      close_socket
    end

    private

    def close_socket
      @socket&.close rescue nil
      @socket = nil
    end

    def dispatch(event, event_obj)
      callbacks = @callbacks[event.to_sym]
      return if callbacks.empty?

      if defined?(EventMachine) && EventMachine.reactor_running?
        EventMachine.schedule do
          callbacks.each { |cb| cb.call(event_obj) rescue nil }
        end
      else
        callbacks.each { |cb| cb.call(event_obj) rescue nil }
      end
    end
  end
end
