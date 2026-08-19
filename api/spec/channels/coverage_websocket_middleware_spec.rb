# frozen_string_literal: true

require 'rails_helper'
require "faye/websocket"

RSpec.describe CoverageWebSocketMiddleware do
  let(:app) { ->(env) { [200, { 'Content-Type' => 'text/plain' }, ['OK']] } }
  let(:middleware) { described_class.new(app) }
  let(:org) { Current.organization }
  let(:session) { create(:session, tenant_id: org.id) }
  
  let(:mock_ws) { instance_double('Faye::WebSocket') }
  let(:mock_redis) { instance_double(Redis) }
  
  before do
    allow(Faye::WebSocket).to receive(:websocket?).and_return(true)
    allow(Faye::WebSocket).to receive(:new).and_return(mock_ws)
    allow(mock_ws).to receive(:rack_response).and_return([-1, {}, []])
    
    # Store event callbacks to trigger them manually
    @callbacks = {}
    allow(mock_ws).to receive(:on) do |event, &block|
      @callbacks[event] = block
    end
    
    allow(mock_ws).to receive(:send)
    allow(mock_ws).to receive(:close)
    
    allow(Redis).to receive(:new).and_return(mock_redis)
    allow(mock_redis).to receive(:subscribe)
    allow(mock_redis).to receive(:unsubscribe)
    allow(mock_redis).to receive(:disconnect!)
  end

  def trigger_event(event, data = nil)
    event_double = double('event', data: data)
    @callbacks[event].call(event_double) if @callbacks[event]
  end

  describe '#call' do
    context 'when not a websocket request' do
      let(:env) { { 'PATH_INFO' => "/ws/sessions/#{session.id}/coverage" } }
      
      before do
        allow(Faye::WebSocket).to receive(:websocket?).and_return(false)
      end

      it 'passes the request to the next middleware' do
        status, _, _ = middleware.call(env)
        expect(status).to eq(200)
      end
    end

    context 'when path does not match' do
      let(:env) { { 'PATH_INFO' => '/some/other/path' } }

      it 'passes the request to the next middleware' do
        status, _, _ = middleware.call(env)
        expect(status).to eq(200)
      end
    end

    context 'when valid websocket request' do
      let(:valid_token) { 'valid.jwt.token' }
      let(:env) do
        {
          'PATH_INFO' => "/ws/sessions/#{session.id}/coverage",
          'HTTP_AUTHORIZATION' => "Bearer #{valid_token}"
        }
      end

      before do
        allow(Thread).to receive(:new).and_yield
        allow(JsonWebToken).to receive(:decode).with(valid_token).and_return({ scheme: org.scheme, role: 'assessor' })
      end

      it 'returns a websocket rack response' do
        expect(middleware.call(env)).to eq([-1, {}, []])
      end

      describe 'on :open' do
        it 'authenticates via header and sends initial state' do
          middleware.call(env)
          
          expect(mock_ws).to receive(:send).with(match(/coverage_update/))
          trigger_event(:open)
        end

        it 'subscribes to redis coverage updates' do
          middleware.call(env)
          
          expect(Redis).to receive(:new).and_return(mock_redis)
          expect(mock_redis).to receive(:subscribe).with("coverage:#{session.id}")
          
          trigger_event(:open)
        end

        context 'with missing auth header' do
          let(:env) { { 'PATH_INFO' => "/ws/sessions/#{session.id}/coverage" } }

          it 'does not send state or subscribe to redis' do
            middleware.call(env)
            
            expect(mock_ws).not_to receive(:send)
            expect(Redis).not_to receive(:new)
            
            trigger_event(:open)
          end
        end
      end

      describe 'on :message' do
        let(:env) { { 'PATH_INFO' => "/ws/sessions/#{session.id}/coverage" } }

        before do
          allow(JsonWebToken).to receive(:decode).with(valid_token).and_return({ scheme: org.scheme })
        end

        it 'authenticates via message payload' do
          middleware.call(env)
          trigger_event(:open)
          
          expect(mock_ws).to receive(:send).with(match(/coverage_update/))
          trigger_event(:message, { type: 'auth', token: valid_token }.to_json)
        end

        it 'closes connection on auth failure' do
          allow(JsonWebToken).to receive(:decode).and_raise(StandardError, 'Invalid token')
          
          middleware.call(env)
          trigger_event(:open)
          
          expect(mock_ws).to receive(:send).with(match(/auth_failed/))
          expect(mock_ws).to receive(:close)
          
          trigger_event(:message, { type: 'auth', token: 'bad-token' }.to_json)
        end
      end

      describe 'on :close' do
        it 'cleans up redis subscription' do
          middleware.call(env)
          trigger_event(:open)
          
          expect(mock_redis).to receive(:unsubscribe)
          trigger_event(:close)
          
          # Wait for background thread to execute
          sleep 0.1
        end
      end
    end
  end
end
