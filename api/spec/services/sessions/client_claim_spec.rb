# frozen_string_literal: true

require 'rails_helper'
require 'support/isolated_redis'
require 'support/interview_session_helpers'

RSpec.describe Sessions::ClientClaim, :aggregate_failures do
  include InterviewSessionHelpers
  include IsolatedRedis
  include ActiveSupport::Testing::TimeHelpers

  let(:session) { create_interview_session(time_limit_min: 30) }
  let(:claim) { described_class.new(session) }
  let(:browser_a) { 'a' * 32 }
  let(:browser_b) { 'b' * 32 }

  before do
    isolate_claim_store
    session.assessment
  end

  def reset_id(seed = 'c')
    seed * 32
  end

  def race_end_against_rejoin
    connection = fresh_connection
    ended, rejoined = [-> { claim.finalize(connection) }, -> { claim.admit(browser_a) }]
                      .map { |step| Thread.new(&step) }.map(&:value)
    [ended, rejoined == :closing]
  end

  def fresh_connection
    Redis.new(url: ENV.fetch('REDIS_URL')).del("interview_access:#{session.id}")
    claim.admit(browser_a)
  end

  describe '#admit' do
    it 'lets the first browser in and refuses a second browser' do
      expect(claim.admit(browser_a)).to match(/\A\h{32}\z/)
      expect(claim.admit(browser_b)).to eq(:taken)
    end

    it 'gives the owning browser a new connection when it rejoins' do
      first_connection = claim.admit(browser_a)
      second_connection = claim.admit(browser_a)

      expect(second_connection).to match(/\A\h{32}\z/)
      expect(second_connection).not_to eq(first_connection)
    end

    it 'rejects malformed client ids without claiming' do
      [nil, '', 'short', 'A' * 32, "#{'a' * 32}\n", ['a' * 32]].each do |client_id|
        expect(claim.admit(client_id)).to eq(:taken)
      end
      expect(claim.admit(browser_a)).to match(/\A\h{32}\z/)
    end

    it 'expires the claim after the time limit plus a buffer' do
      claim.admit(browser_a)

      expect(Redis.new(url: ENV.fetch('REDIS_URL')).ttl("interview_access:#{session.id}"))
        .to be_within(5).of((30.minutes + 1.hour).to_i)
    end

    it 'keeps claims of different sessions independent' do
      claim.admit(browser_a)

      expect(described_class.new(create_interview_session).admit(browser_b)).to match(/\A\h{32}\z/)
    end

    it 'admits exactly one of many browsers starting at the same moment' do
      browsers = Array.new(20) { |i| i.to_s(16).rjust(32, '0') }

      results = browsers.map { |browser| Thread.new { claim.admit(browser) } }.map(&:value)

      expect(results.count { |result| result != :taken }).to eq(1)
    end

    it 'fails closed when Redis is unavailable' do
      allow(Redis).to receive(:new).and_raise(Redis::CannotConnectError)

      expect { claim.admit(browser_a) }.to raise_error(described_class::Unavailable)
    end
  end

  describe '#reset' do
    it 'moves the interview to a new browser and revokes the old one' do
      old_connection = claim.admit(browser_a)

      claim.reset(reset_id)

      expect(claim.replaced?(old_connection)).to be(true)
      expect(claim.admit(browser_a)).to eq(:taken)
      expect(claim.admit(browser_b)).to match(/\A\h{32}\z/)
    end

    it 'stops a browser that was admitted just before the reset from staying current' do
      late_connection = claim.admit(browser_a)
      claim.reset(reset_id)
      claim.admit(browser_b)

      expect(claim.replaced?(late_connection)).to be(true)
      expect(claim.disconnected(late_connection)).to be_nil
    end

    it 'does not cut off the candidate when the same reset is retried' do
      claim.admit(browser_a)
      claim.reset(reset_id)
      rejoined = claim.admit(browser_b)

      claim.reset(reset_id)

      expect(claim.replaced?(rejoined)).to be(false)
    end

    it 'returns the same token and deadline when a reset is retried' do
      claim.admit(browser_a)

      first_result = claim.reset(reset_id)

      expect(claim.reset(reset_id)).to eq(first_result)
    end

    it 'treats a new reset as a new action' do
      claim.admit(browser_a)
      claim.reset(reset_id('c'))
      rejoined = claim.admit(browser_b)

      claim.reset(reset_id('d'))

      expect(claim.replaced?(rejoined)).to be(true)
    end

    it 'lifts earlier revocations when reset again with no new owner' do
      claim.admit(browser_a)
      claim.reset(reset_id('c'))
      expect(claim.admit(browser_a)).to eq(:taken)

      claim.reset(reset_id('d'))

      expect(claim.admit(browser_a)).to match(/\A\h{32}\z/)
    end

    it 'does nothing when nobody has connected' do
      expect(claim.reset(reset_id)).to be_nil
      expect(claim.admit(browser_a)).to match(/\A\h{32}\z/)
    end

    it 'gives a connected interview a full grace period' do
      claim.admit(browser_a)

      _token, deadline = claim.reset(reset_id)

      expect(deadline).to be_within(2).of(Time.current.to_i + described_class::RECONNECT_GRACE)
    end

    it 'keeps the existing deadline when the candidate has already disconnected' do
      existing_deadline = claim.disconnected(claim.admit(browser_a))
      travel 100.seconds

      _token, deadline = claim.reset(reset_id)

      expect(deadline).to eq(existing_deadline)
    end

    it 'raises when Redis is unavailable' do
      allow(Redis).to receive(:new).and_raise(Redis::CannotConnectError)

      expect { claim.reset(reset_id) }.to raise_error(described_class::Unavailable)
    end
  end

  describe '#disconnected' do
    it 'returns a deadline for the latest connection' do
      connection = claim.admit(browser_a)

      expect(claim.disconnected(connection)).to be_within(2).of(Time.current.to_i + 120)
    end

    it 'ignores a stale connection whose close arrives after the browser rejoined' do
      old_connection = claim.admit(browser_a)
      claim.admit(browser_a)

      expect(claim.disconnected(old_connection)).to be_nil
    end
  end

  describe '#replaced?' do
    it 'is true for an older connection of the same browser' do
      old_connection = claim.admit(browser_a)
      claim.admit(browser_a)

      expect(claim.replaced?(old_connection)).to be(true)
    end

    it 'keeps the interview running when Redis lost the claim' do
      connection = claim.admit(browser_a)
      Redis.new(url: ENV.fetch('REDIS_URL')).flushdb

      expect(claim.replaced?(connection)).to be(false)
    end
  end

  describe '#finalize' do
    it 'succeeds for the latest connection, repeatably, and then blocks new connections' do
      connection = claim.admit(browser_a)

      expect(claim.finalize(connection)).to be(true)
      expect(claim.finalize(connection)).to be(true)
      expect(claim.admit(browser_a)).to eq(:closing)
    end

    it 'refuses when the browser already rejoined' do
      old_connection = claim.admit(browser_a)
      claim.admit(browser_a)

      expect(claim.finalize(old_connection)).to be(false)
    end

    it 'never both ends the session and admits a rejoining browser' do
      outcomes = Array.new(50) { race_end_against_rejoin }

      expect(outcomes).to all(satisfy { |finalized, blocked| finalized == blocked })
    end
  end

  describe '#schedule_end' do
    it 'queues the end at the deadline' do
      claim.schedule_end('token', 1_900_000_000)

      job = SessionGraceEndWorker.jobs.last
      expect(job['args']).to eq([session.id, 'token'])
      expect(job['at']).to eq(1_900_000_000)
    end

    it 'raises when the queue is unavailable' do
      allow(SessionGraceEndWorker).to receive(:perform_at).and_raise(RedisClient::CannotConnectError)

      expect { claim.schedule_end('token', 1) }.to raise_error(described_class::Unavailable)
    end
  end

  describe '#claimed_by_other?' do
    it 'is false before anyone starts and for the owning browser' do
      expect(claim.claimed_by_other?(browser_b)).to be(false)

      claim.admit(browser_a)

      expect(claim.claimed_by_other?(browser_a)).to be(false)
    end

    it 'is true for any other browser, including one without a client id' do
      claim.admit(browser_a)

      expect(claim.claimed_by_other?(browser_b)).to be(true)
      expect(claim.claimed_by_other?(nil)).to be(true)
    end

    it 'is true for a browser whose access was reset, even before a new owner arrives' do
      claim.admit(browser_a)
      claim.reset(reset_id)

      expect(claim.claimed_by_other?(browser_a)).to be(true)
    end

    it 'reports not in use when Redis is unavailable' do
      allow(Redis).to receive(:new).and_raise(Redis::CannotConnectError)

      expect(claim.claimed_by_other?(browser_b)).to be(false)
    end
  end
end
