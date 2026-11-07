# frozen_string_literal: true

require 'rails_helper'

# Each connection gets its own middleware instance and ConnectionState, mirroring two Puma workers
# that share nothing in memory: the database is the only channel between them.
# rubocop:disable Metrics/BlockLength
RSpec.describe AudioWebSocketMiddleware do
  let(:fake_browser_class) do
    Class.new do
      attr_reader :sent
      attr_accessor :closed

      def initialize
        @sent = []
        @closed = false
      end

      def send(payload)
        @sent << payload
        true
      end

      def close
        @closed = true
      end

      def messages
        @sent.select { |p| p.is_a?(String) }.map { |p| JSON.parse(p) }
      end
    end
  end

  let(:fake_gemini_class) do
    Class.new do
      attr_reader :callbacks, :connected_with
      attr_accessor :closed, :superseded, :connected

      def initialize(callbacks)
        @callbacks = callbacks
        @connected = true
      end

      def connect(resumption_handle: nil)
        @connected_with = resumption_handle
      end

      def close
        @closed = true
      end

      def supersede!
        @superseded = true
      end

      def accepting_audio? = true
      def silence_pumping? = false
      def inactivity_close = false
      def trigger_opening; end
      def inject_context(*) = true
    end
  end

  let(:organization) do
    Organization.create!(name: 'Test Corp', scheme: 'test-corp', identifier: 'test-corp', host: 'test.example.test')
  end
  let(:assessment) do
    Assessment.unscoped.create!(
      tenant_id: organization.id, created_by: 1, name: 'Reconnect', time_limit_min: 45, language: 'en',
      system_prompt: 'prompt'
    )
  end
  let(:session) { Session.unscoped.create!(tenant_id: organization.id, assessment: assessment) }

  before do
    stub_const('AudioWebSocketMiddleware::BROWSER_GRACE_PERIOD', 0.2)
    stub_const('AudioWebSocketMiddleware::OWNERSHIP_CHECK_INTERVAL', 0.05)
    stub_const('AudioWebSocketMiddleware::START_TIMEOUT', 5)
    allow(PortfolioGeneratorWorker).to receive(:perform_async)
    allow(Gemini::LiveClient).to receive(:new) { |**callbacks| fake_gemini_class.new(callbacks) }
  end

  def on_reactor
    result = Queue.new
    EM.schedule do
      result << [:ok, yield]
    rescue StandardError, RSpec::Expectations::ExpectationNotMetError => e
      result << [:error, e]
    end
    status, value = result.pop
    raise value if status == :error

    value
  end

  def wait_until(timeout: 2)
    deadline = Process.clock_gettime(Process::CLOCK_MONOTONIC) + timeout
    until yield
      raise 'condition not met before timeout' if Process.clock_gettime(Process::CLOCK_MONOTONIC) > deadline

      Kernel.sleep(0.01)
    end
  end

  def elapse(seconds)
    Kernel.sleep(seconds)
  end

  # ready: false leaves Gemini mid-handshake, before setupComplete.
  def open_connection(ready: true)
    middleware = described_class.new(->(_env) { [200, {}, []] })
    browser = fake_browser_class.new
    state = described_class::ConnectionState.new
    env = Rack::MockRequest.env_for("/ws/sessions/#{session.id}/audio?token=#{session.invite_token}")

    on_reactor { middleware.send(:handle_browser_open, env, session.id.to_s, browser, state) }
    conn = { middleware: middleware, browser: browser, state: state }
    gemini_ready(conn) if ready
    conn
  end

  def gemini_ready(conn)
    on_reactor { conn[:state].gemini_client.callbacks[:on_ready].call }
  end

  def exhaust_gemini_retries(conn)
    conn[:state].reconnect_attempts = described_class::MAX_RECONNECT_ATTEMPTS
    on_reactor do
      conn[:middleware].send(:handle_gemini_close, conn[:browser], conn[:state], code: 1008, reason: 'rejected')
    end
  end

  def message_types(conn) = conn[:browser].messages.map { |m| m['type'] }

  def disconnect_browser(conn)
    event = Struct.new(:code).new(1006)
    on_reactor { conn[:middleware].send(:handle_browser_close, event, conn[:browser], conn[:state], session.id.to_s) }
  end

  def reloaded_session = Session.unscoped.find(session.id)

  describe 'browser reconnect (T4)' do
    it 'does not end the session when the old connection grace timer expires after a reconnect' do
      first = open_connection
      disconnect_browser(first)
      open_connection

      elapse(0.4)

      expect(reloaded_session).to be_active
    end

    it 'still ends the session when nobody reconnects within the grace period' do
      first = open_connection
      disconnect_browser(first)

      wait_until { reloaded_session.ended? }

      expect(reloaded_session.end_reason).to eq('error')
    end

    it 'closes the Gemini connection of the replaced connection' do
      first = open_connection
      disconnect_browser(first)
      open_connection

      wait_until { first[:state].gemini_client.closed }

      expect(first[:state].gemini_client).to have_attributes(closed: true, superseded: true)
    end

    it 'keeps the replacement connection Gemini client open' do
      first = open_connection
      disconnect_browser(first)
      second = open_connection

      elapse(0.4)

      expect(second[:state].gemini_client.closed).to be_falsey
    end

    it 'resumes from the newest token seen by the old connection, not the debounced one' do
      first = open_connection
      first[:state].latest_resumption_token = 'newest-token'
      disconnect_browser(first)

      second = open_connection

      expect(second[:state].gemini_client.connected_with).to eq('newest-token')
    end

    it 'tells the browser that the session was resumed' do
      first = open_connection
      first[:state].latest_resumption_token = 'newest-token'
      disconnect_browser(first)
      second = open_connection

      started = second[:browser].messages.find { |m| m['type'] == 'session_started' }
      expect(started['resumed']).to be(true)
    end
  end

  describe 'two live tabs' do
    it 'tells the replaced tab to stop instead of letting both fight for the session' do
      first = open_connection
      open_connection

      wait_until { first[:browser].closed }

      expect(first[:browser].messages.map { |m| m['type'] }).to include('session_superseded')
    end

    it 'does not schedule an end of session when the replaced tab finally closes' do
      first = open_connection
      open_connection
      wait_until { first[:browser].closed }

      disconnect_browser(first)
      elapse(0.4)

      expect(reloaded_session).to be_active
    end

    it 'ignores a late token from the replaced connection' do
      first = open_connection
      second = open_connection
      second[:state].latest_resumption_token = 'owner-token'
      on_reactor { second[:middleware].send(:persist_resumption_token, second[:state]) }

      first[:state].latest_resumption_token = 'stale-token'
      on_reactor { first[:middleware].send(:persist_resumption_token, first[:state]) }

      expect(reloaded_session.gemini_resumption_token).to eq('owner-token')
    end
  end

  describe 'a session ended from elsewhere' do
    it 'stops the connection instead of leaving a Gemini client running (session 13 zombie)' do
      conn = open_connection

      Sessions::EndHandler.new(reloaded_session).call(reason: 'manual_assessor')
      wait_until { conn[:browser].closed }

      expect(conn[:browser].messages.map { |m| m['type'] }).to include('session_ended')
      expect(conn[:state].gemini_client.closed).to be(true)
    end
  end

  describe 'Gemini failure on a replaced connection' do
    it 'cannot end the session now owned by the new connection' do
      first = open_connection
      open_connection

      first[:state].reconnect_attempts = described_class::MAX_RECONNECT_ATTEMPTS
      on_reactor do
        first[:middleware].send(:handle_gemini_close, first[:browser], first[:state], code: 1011, reason: 'gone')
      end

      expect(reloaded_session).to be_active
    end
  end

  describe 'failure before the interview starts (T2)' do
    it 'does not start the interview until Gemini is ready' do
      open_connection(ready: false)

      expect(reloaded_session).to be_pending
      expect(reloaded_session.started_at).to be_nil
    end

    it 'starts the interview once Gemini is ready' do
      conn = open_connection(ready: false)
      assessment.assessment_skills.create!(
        skill_label: 'Testing', display_order: 1,
        l1_anchor: 'a', l2_anchor: 'b', l3_anchor: 'c', l4_anchor: 'd', l5_anchor: 'e'
      )
      gemini_ready(conn)

      expect(reloaded_session).to be_active
      expect(reloaded_session.started_at).to be_present
      expect(reloaded_session.coverage_maps.count).to eq(1)
      expect(message_types(conn)).to include('session_started')
    end

    it 'keeps the invitation usable when Gemini keeps rejecting the handshake' do
      conn = open_connection(ready: false)

      exhaust_gemini_retries(conn)

      expect(reloaded_session).to be_pending
      expect(reloaded_session.portfolio).to be_nil
      expect(PortfolioGeneratorWorker).not_to have_received(:perform_async)
      expect(message_types(conn)).to include('start_failed')
      expect(message_types(conn)).not_to include('session_ended')
    end

    it 'closes Gemini and the browser after a failed start' do
      conn = open_connection(ready: false)

      exhaust_gemini_retries(conn)
      wait_until { conn[:browser].closed }

      expect(conn[:state].gemini_client.closed).to be(true)
    end

    it 'lets the candidate retry with the same invitation after a failed start' do
      exhaust_gemini_retries(open_connection(ready: false))

      retry_conn = open_connection

      expect(reloaded_session).to be_active
      expect(message_types(retry_conn)).to include('session_started')
    end

    it 'treats a retry that succeeds as the start of the interview, with the AI opening' do
      stub_const('AudioWebSocketMiddleware::RECONNECT_BACKOFF', [0.01].freeze)
      conn = open_connection(ready: false)
      first_client = conn[:state].gemini_client

      on_reactor do
        conn[:middleware].send(:handle_gemini_close, conn[:browser], conn[:state], code: 1011, reason: 'transient')
      end
      wait_until { !conn[:state].gemini_client.equal?(first_client) }
      gemini_ready(conn)

      expect(reloaded_session).to be_active
      expect(message_types(conn)).to include('session_started')
      expect(message_types(conn)).not_to include('reconnecting', 'reconnected')
    end

    it 'does not burn the invitation when the candidate leaves before the interview starts' do
      conn = open_connection(ready: false)

      disconnect_browser(conn)
      elapse(0.4)

      expect(reloaded_session).to be_pending
      expect(conn[:state].gemini_client.closed).to be(true)
    end

    it 'gives up when Gemini never answers the handshake' do
      stub_const('AudioWebSocketMiddleware::START_TIMEOUT', 0.05)
      conn = open_connection(ready: false)

      wait_until { conn[:browser].closed }

      expect(message_types(conn)).to include('start_failed')
      expect(reloaded_session).to be_pending
    end

    it 'does not apply the start timeout once the interview has started' do
      stub_const('AudioWebSocketMiddleware::START_TIMEOUT', 0.05)
      conn = open_connection

      elapse(0.2)

      expect(message_types(conn)).not_to include('start_failed')
      expect(reloaded_session).to be_active
    end

    it 'does not let a replaced connection start the interview' do
      first = open_connection(ready: false)
      open_connection(ready: false)

      gemini_ready(first)

      expect(reloaded_session).to be_pending
      expect(message_types(first)).not_to include('session_started')
    end
  end

  describe 'failure after the interview started (T3)' do
    it 'ends the session and reports the error as an error' do
      conn = open_connection

      exhaust_gemini_retries(conn)

      expect(reloaded_session.end_reason).to eq('error')
      ended = conn[:browser].messages.find { |m| m['type'] == 'session_ended' }
      expect(ended['reason']).to eq('error')
      expect(message_types(conn)).not_to include('start_failed')
    end

    it 'does not treat a failed browser reconnect into a running interview as a failed start' do
      first = open_connection
      disconnect_browser(first)
      second = open_connection(ready: false)

      exhaust_gemini_retries(second)

      expect(reloaded_session.end_reason).to eq('error')
      expect(message_types(second)).to include('session_ended')
    end

    it 'tells a browser returning to an ended session how it really ended' do
      first = open_connection
      Sessions::EndHandler.new(reloaded_session).call(reason: 'error')
      wait_until { first[:browser].closed }

      conn = open_connection(ready: false)

      ended = conn[:browser].messages.find { |m| m['type'] == 'session_ended' }
      expect(ended['reason']).to eq('error')
      expect(conn[:browser].closed).to be(true)
    end
  end

  describe 'transcript writes during a takeover' do
    it 'keeps both turns when two connections pick the same turn number' do
      middleware = described_class.new(->(_env) { [200, {}, []] })
      session

      middleware.send(:save_transcript_turn, session, 5, 'ai', 'flushed by the old connection')
      saved = middleware.send(:save_transcript_turn, session, 5, 'candidate', 'said on the new connection')

      expect(session.transcript_turns.reload.map(&:text)).to contain_exactly(
        'flushed by the old connection', 'said on the new connection'
      )
      expect(saved).to eq(6)
    end

    it 'stays idempotent when the same turn is saved twice' do
      middleware = described_class.new(->(_env) { [200, {}, []] })
      session

      middleware.send(:save_transcript_turn, session, 5, 'ai', 'same text')
      middleware.send(:save_transcript_turn, session, 5, 'ai', 'same text')

      expect(session.transcript_turns.reload.count).to eq(1)
    end
  end
end
# rubocop:enable Metrics/BlockLength
