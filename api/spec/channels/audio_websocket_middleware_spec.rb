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

  def open_connection
    middleware = described_class.new(->(_env) { [200, {}, []] })
    browser = fake_browser_class.new
    state = described_class::ConnectionState.new
    env = Rack::MockRequest.env_for("/ws/sessions/#{session.id}/audio?token=#{session.invite_token}")

    on_reactor { middleware.send(:handle_browser_open, env, session.id.to_s, browser, state) }
    conn = { middleware: middleware, browser: browser, state: state }
    conn = { middleware: middleware, browser: browser, state: state }
    on_reactor { state.gemini_client.callbacks[:on_ready].call }
    conn
  end

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
end
# rubocop:enable Metrics/BlockLength
