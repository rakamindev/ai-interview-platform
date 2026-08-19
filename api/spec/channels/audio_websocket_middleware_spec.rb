# frozen_string_literal: true

require 'rails_helper'
require "faye/websocket"

RSpec.describe AudioWebSocketMiddleware do
  let(:app) { ->(env) { [200, { 'Content-Type' => 'text/plain' }, ['OK']] } }
  let(:middleware) { described_class.new(app) }
  let(:org) { Current.organization }
  let(:assessment) { create(:assessment, system_prompt: 'Test Prompt') }
  let(:session) { create(:session, tenant_id: org.id, assessment: assessment) }
  
  let(:mock_ws) { instance_double('Faye::WebSocket') }
  let(:mock_gemini) { instance_double('Gemini::LiveClient') }
  
  before do
    allow(Faye::WebSocket).to receive(:websocket?).and_return(true)
    allow(Faye::WebSocket).to receive(:new).and_return(mock_ws)
    allow(mock_ws).to receive(:rack_response).and_return([-1, {}, []])
    
    @callbacks = {}
    allow(mock_ws).to receive(:on) do |event, &block|
      @callbacks[event] = block
    end
    
    allow(mock_ws).to receive(:send)
    allow(mock_ws).to receive(:close)
    
    allow(Gemini::LiveClient).to receive(:new).and_return(mock_gemini)
    allow(mock_gemini).to receive(:connect)
    allow(mock_gemini).to receive(:close)
    allow(mock_gemini).to receive(:send_audio)
    allow(mock_gemini).to receive(:accepting_audio?).and_return(true)
    allow(mock_gemini).to receive(:trigger_opening)
    allow(mock_gemini).to receive(:inject_context).and_return(true)
    allow(mock_gemini).to receive(:connected).and_return(true)
    allow(mock_gemini).to receive(:silence_pumping?).and_return(false)
    allow(mock_gemini).to receive(:inactivity_close).and_return(false)
    allow(mock_gemini).to receive(:supersede!)
    
    # Mock EventMachine timers
    allow(EM).to receive(:add_timer).and_yield
    allow(EM).to receive(:schedule).and_yield
    allow(EM::Timer).to receive(:new).and_return(double('timer', cancel: true))
    
    # Allow background threads to run synchronously for tests
    allow(Thread).to receive(:new).and_yield
  end

  def trigger_event(event, data = nil)
    event_double = double('event', data: data, code: 1000)
    @callbacks[event].call(event_double) if @callbacks[event]
  end

  describe '#call' do
    context 'when valid websocket request' do
      let(:valid_token) { 'valid.jwt.token' }
      let(:env) do
        {
          'PATH_INFO' => "/ws/sessions/#{session.id}/audio",
          'HTTP_AUTHORIZATION' => "Bearer #{valid_token}",
          'rack.input' => StringIO.new
        }
      end

      before do
        allow(JsonWebToken).to receive(:decode).with(valid_token).and_return({ scheme: org.scheme })
      end

      describe 'on :open' do
        it 'authenticates and connects to Gemini' do
          middleware.call(env)
          
          expect(Gemini::LiveClient).to receive(:new)
          expect(mock_gemini).to receive(:connect)
          
          trigger_event(:open)
        end

        it 'handles missing system prompt by generating one' do
          session.assessment.update_column(:system_prompt, nil)
          compiler_mock = instance_double(Assessments::SystemPromptCompiler, call: 'Generated Prompt')
          allow(Assessments::SystemPromptCompiler).to receive(:new).and_return(compiler_mock)
          
          middleware.call(env)
          trigger_event(:open)
          
          expect(session.assessment.reload.system_prompt).to eq('Generated Prompt')
        end

        it 'fails when authentication is invalid' do
          allow(JsonWebToken).to receive(:decode).and_raise(StandardError, 'Invalid token')
          
          middleware.call(env)
          
          expect(mock_ws).to receive(:send).with(match(/auth_failed/))
          expect(mock_ws).to receive(:close)
          
          trigger_event(:open)
        end
      end

      describe 'on :message' do
        before do
          middleware.call(env)
          trigger_event(:open)
        end

        it 'forwards binary audio to Gemini when client is accepting' do
          expect(mock_gemini).to receive(:send_audio).with('audio-bytes')
          trigger_event(:message, 'audio-bytes')
        end

        it 'handles JSON control messages (end_session)' do
          expect(mock_ws).to receive(:send).with(match(/session_ended/))
          expect(mock_gemini).to receive(:close)
          
          trigger_event(:message, { type: 'end_session' }.to_json)
        end
      end

      describe 'on :close' do
        before do
          middleware.call(env)
          trigger_event(:open)
        end

        it 'schedules graceful end timer' do
          middleware.call(env)
          trigger_event(:open)
          expect(EM::Timer).to receive(:new).with(AudioWebSocketMiddleware::BROWSER_GRACE_PERIOD)
          trigger_event(:close)
        end
      end
    end
  end
end
