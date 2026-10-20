# frozen_string_literal: true

require 'rails_helper'

RSpec.describe CoverageWebSocketMiddleware do
  let(:middleware) { described_class.new(->(_env) { [404, {}, []] }) }
  let(:owner_organization) { create(:organization) }
  let(:foreign_organization) { create(:organization) }
  let(:assessment) { create(:assessment, organization: owner_organization) }
  let(:session) { create(:session, organization: owner_organization, assessment:, status: 'active') }

  def token_for(organization, role: 'admin')
    JsonWebToken.encode(user_id: 70_001, role:, scheme: organization.scheme)
  end

  describe 'authorization' do
    it 'authenticates an assessor for a session in the token tenant' do
      result, error = middleware.send(:authenticate_assessor_by_token, token_for(owner_organization), session.id)

      expect(error).to be_nil
      expect(result).to eq(session)
    end

    it 'rejects a valid token with a non-assessor role' do
      result, error = middleware.send(:authenticate_assessor_by_token, token_for(owner_organization, role: 'user'), session.id)

      expect(result).to be_nil
      expect(error).to include('Unauthorized')
    end

    it 'rejects a session belonging to another tenant' do
      result, error = middleware.send(:authenticate_assessor_by_token, token_for(foreign_organization), session.id)

      expect(result).to be_nil
      expect(error).to eq('Session not found')
    end
  end

  # One subscriber per process: the middleware joins the fan-out instead of
  # opening a Redis connection and a thread per socket.
  describe 'subscription lifecycle' do
    let(:fake_socket) { FakeCoverageSocket.new }

    def env_for(session_id, token)
      {
        'PATH_INFO' => "/ws/sessions/#{session_id}/coverage",
        'HTTP_AUTHORIZATION' => "Bearer #{token}"
      }
    end

    before do
      CoveragePubsub.reset!
      allow(Faye::WebSocket).to receive(:websocket?).and_return(true)
      allow(Faye::WebSocket).to receive(:new).and_return(fake_socket)
    end

    after { CoveragePubsub.reset! }

    it 'registers the socket on open and releases it on close' do
      middleware.call(env_for(session.id, token_for(owner_organization)))

      expect(fake_socket.handler_for(:open)).to be_present
      fake_socket.trigger(:open)

      expect(CoveragePubsub.registered?(session.id, fake_socket)).to be(true)
      expect(CoveragePubsub.socket_count).to eq(1)

      # The first state is pushed immediately, before any update arrives.
      expect(fake_socket.sent.first).to include('coverage_update')

      fake_socket.trigger(:close)

      expect(CoveragePubsub.registered?(session.id, fake_socket)).to be(false)
      expect(CoveragePubsub.socket_count).to eq(0)
    end

    it 'does not subscribe when the token belongs to another tenant' do
      middleware.call(env_for(session.id, token_for(foreign_organization)))

      fake_socket.trigger(:open)

      expect(CoveragePubsub.socket_count).to eq(0)
      expect(fake_socket.sent).to be_empty
    end

    it 'delivers a published update to every socket watching the session and drops a failing one' do
      failing = FakeCoverageSocket.new(fail_on_send: true)
      allow(Faye::WebSocket).to receive(:new).and_return(fake_socket, failing)

      middleware.call(env_for(session.id, token_for(owner_organization)))
      fake_socket.trigger(:open)

      middleware.call(env_for(session.id, token_for(owner_organization)))
      failing.trigger(:open)

      expect(CoveragePubsub.socket_count).to eq(2)

      publisher = Redis.new(url: ENV.fetch('REDIS_URL', 'redis://localhost:6379/1'))
      publisher.publish("coverage:#{session.id}", { type: 'coverage_update', status: 'active' }.to_json)
      publisher.close

      wait_until(timeout: 5) { fake_socket.received.any? { |payload| payload.include?('"status":"active"') } }

      expect(fake_socket.received).to include(a_string_including('coverage_update'))
      wait_until(timeout: 5) { CoveragePubsub.registered?(session.id, failing) == false }
      expect(CoveragePubsub.registered?(session.id, failing)).to be(false)
      expect(CoveragePubsub.registered?(session.id, fake_socket)).to be(true)
    end

    def wait_until(timeout:)
      deadline = Process.clock_gettime(Process::CLOCK_MONOTONIC) + timeout

      loop do
        return true if yield
        break if Process.clock_gettime(Process::CLOCK_MONOTONIC) > deadline

        sleep 0.05
      end

      false
    end
  end
end
