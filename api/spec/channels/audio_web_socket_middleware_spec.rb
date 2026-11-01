# frozen_string_literal: true

require 'rails_helper'
require 'support/isolated_redis'
require 'support/interview_session_helpers'

RSpec.describe AudioWebSocketMiddleware, :aggregate_failures do
  include InterviewSessionHelpers
  include IsolatedRedis

  let(:middleware) { described_class.new(->(_env) { [200, {}, []] }) }
  let(:session) { create_interview_session }
  let(:first_browser) { 'a' * 32 }
  let(:second_browser) { 'b' * 32 }

  before { isolate_claim_store }

  def connection_env(client_id: nil, session_id: session.id.to_s)
    query = { token: session.invite_token, client_id: client_id }.compact.to_query
    Rack::MockRequest.env_for("/ws/sessions/#{session_id}/audio?#{query}")
  end

  def authenticate(client_id: nil, session_id: session.id.to_s)
    middleware.send(:authenticate_and_load, connection_env(client_id:, session_id:), session_id)
  end

  def open_connection(client_id)
    instance_double(Faye::WebSocket, send: nil, close: nil).tap do |browser_ws|
      middleware.send(:handle_browser_open, connection_env(client_id:), session.id.to_s, browser_ws,
                      described_class::ConnectionState.new)
    end
  end

  it 'admits the first browser that starts the interview' do
    loaded, error = authenticate(client_id: first_browser)

    expect(error).to be_nil
    expect(loaded).to eq(session)
  end

  it 'rejects a second browser with session_in_use while the first is admitted' do
    authenticate(client_id: first_browser)

    loaded, error, code = authenticate(client_id: second_browser)

    expect(loaded).to be_nil
    expect(error).to eq('Interview already in progress in another browser')
    expect(code).to eq('session_in_use')
  end

  it 'readmits the owning browser when it reconnects' do
    authenticate(client_id: first_browser)

    loaded, error = authenticate(client_id: first_browser)

    expect(error).to be_nil
    expect(loaded).to eq(session)
  end

  it 'fails closed with claim_unavailable when Redis cannot be reached' do
    allow(Redis).to receive(:new).and_raise(Redis::CannotConnectError)

    loaded, error, code = authenticate(client_id: first_browser)

    expect(loaded).to be_nil
    expect(error).to eq('Interview service is temporarily unavailable')
    expect(code).to eq('claim_unavailable')
  end

  it 'sends the error code before closing the socket when Redis is down' do
    allow(Redis).to receive(:new).and_raise(Redis::CannotConnectError)

    browser_ws = open_connection(first_browser)

    expect(browser_ws).to have_received(:send)
      .with(a_string_including('"code":"claim_unavailable"', '"recoverable":false')).ordered
    expect(browser_ws).to have_received(:close).ordered
  end

  it 'rejects an invite connection without a valid client id' do
    loaded, _error, code = authenticate

    expect(loaded).to be_nil
    expect(code).to eq('session_in_use')
  end

  it 'still rejects an ended session before claiming it' do
    session.update!(status: 'ended')

    _loaded, error = authenticate(client_id: first_browser)

    expect(error).to eq('Session has ended')
  end

  it 'refuses a rejoin once the grace period has started ending the session' do
    connection = Sessions::ClientClaim.new(session).admit(first_browser)
    Sessions::ClientClaim.new(session).finalize(connection)

    loaded, error = authenticate(client_id: first_browser)

    expect(loaded).to be_nil
    expect(error).to eq('Session has ended')
  end

  describe 'conversation history for a rejoining browser' do
    before do
      allow(middleware).to receive(:connect_to_gemini)
      allow(EM::PeriodicTimer).to receive(:new).and_return(instance_double(EM::PeriodicTimer, cancel: nil))
    end

    def add_turn(number, speaker, text)
      session.transcript_turns.create!(turn_number: number, speaker: speaker, text: text)
    end

    def history_message(*turns)
      { type: 'transcript_history', turns: turns.map { |speaker, text| { speaker:, text: } } }.to_json
    end

    it 'sends the owner the saved conversation in order' do
      add_turn(2, 'candidate', 'I built a table')
      add_turn(1, 'ai', 'Tell me about a project')

      expect(open_connection(first_browser)).to have_received(:send)
        .with(history_message(['ai', 'Tell me about a project'], ['candidate', 'I built a table']))
    end

    it 'limits the history to the most recent turns the page shows' do
      (1..12).each { |number| add_turn(number, 'ai', "Turn #{number}") }

      expect(open_connection(first_browser)).to have_received(:send)
        .with(history_message(*(3..12).map { |number| ['ai', "Turn #{number}"] }))
    end

    it 'sends nothing when there is no conversation yet' do
      browser_ws = open_connection(first_browser)

      expect(browser_ws).not_to have_received(:send)
    end

    it 'never sends the conversation to a browser that was refused' do
      add_turn(1, 'candidate', 'private answer')
      open_connection(first_browser)

      browser_ws = open_connection(second_browser)

      expect(browser_ws).to have_received(:send).once.with(a_string_including('session_in_use'))
      expect(browser_ws).not_to have_received(:send).with(a_string_including('private answer'))
    end

    it 'still starts the interview when the history cannot be loaded' do
      allow(middleware).to receive(:send_transcript_history).and_raise(ActiveRecord::ConnectionTimeoutError)

      open_connection(first_browser)

      expect(middleware).to have_received(:connect_to_gemini)
    end
  end
end
