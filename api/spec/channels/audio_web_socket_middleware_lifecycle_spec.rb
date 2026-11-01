# frozen_string_literal: true

require 'rails_helper'
require 'support/isolated_redis'
require 'support/interview_session_helpers'

RSpec.describe AudioWebSocketMiddleware, :aggregate_failures do
  include InterviewSessionHelpers
  include IsolatedRedis

  let(:middleware) { described_class.new(->(_env) { [200, {}, []] }) }
  let(:session) { create_interview_session }
  let(:browser_ws) { instance_double(Faye::WebSocket, send: nil, close: nil) }
  let(:gemini) { instance_double(Gemini::LiveClient, supersede!: nil, close: nil) }
  let(:state) { described_class::ConnectionState.new }

  before do
    isolate_claim_store
    session.update!(status: 'active', started_at: Time.current)
    state.session = session
    state.gemini_client = gemini
    state.connection_token = claim.admit(browser)
    allow(Thread).to receive(:new).and_yield
    allow(EM).to receive(:schedule).and_yield
  end

  def claim
    Sessions::ClientClaim.new(session)
  end

  def browser
    'a' * 32
  end

  def close_browser
    middleware.send(:handle_browser_close, instance_double(Faye::WebSocket::API::CloseEvent, code: 1006),
                    browser_ws, state, session.id.to_s)
  end

  def run_replacement_check
    check = nil
    allow(EM::PeriodicTimer).to receive(:new) do |_interval, &block|
      check = block
      instance_double(EM::PeriodicTimer, cancel: nil)
    end
    middleware.send(:watch_for_replacement, browser_ws, state)
    check.call
  end

  def pending_gemini_retry
    retry_gemini = nil
    allow(EM).to receive(:add_timer) { |_delay, &block| retry_gemini = block }
    allow(middleware).to receive(:build_gemini_client)
    middleware.send(:schedule_gemini_reconnect, browser_ws, state, 1011)
    retry_gemini
  end

  it 'closes Gemini without callbacks and queues the end when the browser leaves' do
    close_browser

    expect(gemini).to have_received(:supersede!).ordered
    expect(gemini).to have_received(:close).ordered
    expect(SessionGraceEndWorker.jobs.last['args']).to eq([session.id, state.connection_token])
  end

  it 'saves the latest resumption token so the next connection resumes from it' do
    state.latest_resumption_token = 'latest-handle'

    close_browser

    expect(session.reload.gemini_resumption_token).to eq('latest-handle')
  end

  it 'does not queue an end or overwrite the token when the browser already rejoined' do
    state.latest_resumption_token = 'stale-handle'
    claim.admit(browser)

    close_browser

    expect(SessionGraceEndWorker.jobs).to be_empty
    expect(session.reload.gemini_resumption_token).not_to eq('stale-handle')
  end

  it 'does nothing for a socket that was never admitted' do
    state.session = nil

    close_browser

    expect(gemini).not_to have_received(:close)
    expect(SessionGraceEndWorker.jobs).to be_empty
  end

  it 'still closes Gemini and saves the token when Redis is down at disconnect' do
    state.latest_resumption_token = 'latest-handle'
    allow(Redis).to receive(:new).and_raise(Redis::CannotConnectError)

    close_browser

    expect(gemini).to have_received(:close)
    expect(session.reload.gemini_resumption_token).to eq('latest-handle')
  end

  it 'leaves a current connection alone when checking for replacement' do
    run_replacement_check

    expect(browser_ws).not_to have_received(:close)
  end

  it 'tells a replaced browser why before closing it' do
    claim.reset('c' * 32)

    run_replacement_check

    expect(browser_ws).to have_received(:send)
      .with(a_string_including('"code":"connection_replaced"', '"recoverable":false')).ordered
    expect(browser_ws).to have_received(:close).ordered
  end

  it 'closes Gemini but queues no end for a replaced browser' do
    claim.reset('c' * 32)
    run_replacement_check

    close_browser

    expect(gemini).to have_received(:close)
    expect(SessionGraceEndWorker.jobs).to be_empty
  end

  it 'keeps the interview running when Redis fails during the check' do
    allow(Redis).to receive(:new).and_raise(Redis::CannotConnectError)

    run_replacement_check

    expect(browser_ws).not_to have_received(:close)
  end

  it 'does not open a new Gemini session after the browser has left' do
    retry_gemini = pending_gemini_retry

    close_browser
    retry_gemini.call

    expect(middleware).not_to have_received(:build_gemini_client)
  end
end
