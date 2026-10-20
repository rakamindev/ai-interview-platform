# frozen_string_literal: true

# Stand-ins for the two sockets AudioWebSocketMiddleware sits between, so its specs never open a
# connection: FakeBrowserSocket for the candidate's Faye::WebSocket, FakeLiveClient for Gemini::LiveClient.
module AudioSocketDoubles
  Event = Struct.new(:data, :code)

  class FakeBrowserSocket
    attr_reader :sent

    def initialize
      @handlers = {}
      @sent = []
      @closed = false
    end

    def on(event, &block)
      @handlers[event] = block
    end

    def fire(event, data = nil, code: nil)
      @handlers.fetch(event).call(Event.new(data, code))
    end

    # Faye's API is #send; __send__ still works for anything that needs Object#send.
    def send(data)
      @sent << data
    end

    def close
      @closed = true
    end

    def closed? = @closed

    def rack_response = [-1, {}, []]

    # Control messages are JSON strings; audio goes out as an Array of bytes.
    def messages = @sent.grep(String).map { JSON.parse(_1) }

    def types = messages.pluck('type')

    def audio = @sent.grep(Array)
  end

  class FakeLiveClient
    attr_reader :callbacks, :audio, :injected, :connects
    attr_accessor :accepting, :connected, :silence_pumping, :inactivity_close, :deliver

    def initialize(**callbacks)
      @callbacks = callbacks
      @audio = []
      @injected = []
      @connects = []
      @accepting = true
      @connected = true
      @deliver = true
      @closed = false
      @superseded = false
      @opened = false
    end

    def connect(resumption_handle: nil)
      @connects << resumption_handle
    end

    def accepting_audio? = @accepting

    def silence_pumping? = @silence_pumping

    def send_audio(data)
      @audio << data
    end

    # Returns whether the text was delivered, like the real client (false while the silence pump runs).
    def inject_context(text)
      @injected << text
      @deliver
    end

    def trigger_opening
      @opened = true
    end

    def opening_triggered? = @opened

    def close
      @closed = true
    end

    def closed? = @closed

    def supersede!
      @superseded = true
    end

    def superseded? = @superseded

    # Plays Gemini's side: emit(:on_audio, bytes), emit(:on_go_away, time_left: 5, resumption_token: 't').
    def emit(name, *args, **kwargs)
      @callbacks.fetch(name).call(*args, **kwargs)
    end
  end
end
