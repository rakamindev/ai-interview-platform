# frozen_string_literal: true

require 'rails_helper'

RSpec.describe AudioWebSocketMiddleware do
  let(:app) { ->(_env) { [200, {}, ['OK']] } }
  let(:middleware) { described_class.new(app) }
  let(:browser_ws) { instance_double(Faye::WebSocket, close: true, send: true) }
  let(:session) { create(:session, status: 'active') }
  let(:state) do
    s = AudioWebSocketMiddleware::ConnectionState.new
    s.session = session
    s
  end

  describe '#handle_gemini_close' do
    it 'fails fast immediately on non-retriable 1008 code with user-friendly error message' do
      expect(middleware).not_to receive(:schedule_gemini_reconnect)
      expect(Sessions::EndHandler).to receive_message_chain(:new, :call).with(reason: 'error')
      expect(middleware).to receive(:send_json).with(
        browser_ws,
        type: 'session_ended',
        reason: 'error',
        message: 'The server is currently experiencing technical difficulties. Please contact the interviewer if this persists.'
      )
      expect(browser_ws).to receive(:close)

      middleware.send(:handle_gemini_close, browser_ws, state, code: 1008, reason: 'invalid model')
    end

    it 'schedules reconnection for retriable close code when under max attempts' do
      state.reconnect_attempts = 0
      expect(middleware).to receive(:schedule_gemini_reconnect).with(browser_ws, state, 1011)

      middleware.send(:handle_gemini_close, browser_ws, state, code: 1011, reason: 'internal error')
    end

    it 'ends session with friendly error message when max retries exceeded' do
      state.reconnect_attempts = 3
      expect(middleware).not_to receive(:schedule_gemini_reconnect)
      expect(Sessions::EndHandler).to receive_message_chain(:new, :call).with(reason: 'error')
      expect(middleware).to receive(:send_json).with(
        browser_ws,
        type: 'session_ended',
        reason: 'error',
        message: 'The server is currently experiencing technical difficulties. Please contact the interviewer if this persists.'
      )
      expect(browser_ws).to receive(:close)

      middleware.send(:handle_gemini_close, browser_ws, state, code: 1011, reason: 'internal error')
    end
  end
end
