# frozen_string_literal: true

# Minimal stand-in for a Faye::WebSocket used by the WebSocket middleware specs.
# It records the handlers the middleware installs, the frames it sends, and can
# be told to fail on send so a broken socket can be driven through the code.
class FakeCoverageSocket
  attr_reader :sent

  def initialize(fail_on_send: false)
    @handlers    = {}
    @sent        = []
    @received    = []
    @fail_on_send = fail_on_send
    @closed      = false
  end

  def on(event, &block)
    @handlers[event] = block
  end

  def handler_for(event)
    @handlers[event]
  end

  def trigger(event, payload = nil)
    handler = @handlers[event]
    return unless handler

    event_object = payload.respond_to?(:data) ? payload : FakeCoverageEvent.new(payload)
    handler.call(event_object)
  end

  def send(payload)
    raise IOError, 'socket is gone' if @fail_on_send

    @sent << payload
    @received << payload
  end

  def received
    @received
  end

  def close
    @closed = true
  end

  def closed?
    @closed
  end

  def rack_response
    [200, {}, []]
  end
end

FakeCoverageEvent = Struct.new(:data)
