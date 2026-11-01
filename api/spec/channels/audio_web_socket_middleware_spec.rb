# frozen_string_literal: true

require 'rails_helper'
require 'support/fake_redis'
require 'support/interview_session_helpers'

RSpec.describe AudioWebSocketMiddleware, :aggregate_failures do
  include InterviewSessionHelpers

  let(:middleware) { described_class.new(->(_env) { [200, {}, []] }) }
  let(:session) { create_interview_session }
  let(:first_browser) { 'a' * 32 }
  let(:second_browser) { 'b' * 32 }

  before { allow(Redis).to receive(:new).and_return(FakeRedis.new) }

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
end
