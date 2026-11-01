# frozen_string_literal: true

require 'rails_helper'
require 'support/fake_redis'
require 'support/interview_session_helpers'

RSpec.describe Sessions::ClientClaim, :aggregate_failures do
  include InterviewSessionHelpers

  let(:redis) { FakeRedis.new }
  let(:session) { create_interview_session(time_limit_min: 30) }
  let(:first_browser) { 'a' * 32 }
  let(:second_browser) { 'b' * 32 }

  before { allow(Redis).to receive(:new).and_return(redis) }

  describe '#claim' do
    it 'lets the first browser claim the interview and refuses a second browser' do
      expect(described_class.new(session).claim(first_browser)).to be(true)
      expect(described_class.new(session).claim(second_browser)).to be(false)
    end

    it 'lets the owning browser claim again after a refresh' do
      described_class.new(session).claim(first_browser)

      expect(described_class.new(session).claim(first_browser)).to be(true)
    end

    it 'expires the claim after the time limit plus a buffer' do
      described_class.new(session).claim(first_browser)

      expect(redis.ttls["interview_client:#{session.id}"]).to eq(30.minutes + 1.hour)
    end

    it 'rejects malformed client ids without claiming' do
      [nil, '', 'short', 'A' * 32, "#{'a' * 32}\n", ['a' * 32]].each do |client_id|
        expect(described_class.new(session).claim(client_id)).to be(false)
      end
      expect(described_class.new(session).claim(first_browser)).to be(true)
    end

    it 'fails closed when Redis is unavailable' do
      allow(redis).to receive(:set).and_raise(Redis::CannotConnectError)

      expect { described_class.new(session).claim(first_browser) }
        .to raise_error(described_class::Unavailable)
    end

    it 'keeps claims of different sessions independent' do
      other_session = create_interview_session

      described_class.new(session).claim(first_browser)

      expect(described_class.new(other_session).claim(second_browser)).to be(true)
    end
  end

  describe '#claimed_by_other?' do
    it 'is false before anyone starts and for the owning browser' do
      expect(described_class.new(session).claimed_by_other?(second_browser)).to be(false)

      described_class.new(session).claim(first_browser)

      expect(described_class.new(session).claimed_by_other?(first_browser)).to be(false)
    end

    it 'is true for any other browser, including one without a client id' do
      described_class.new(session).claim(first_browser)

      expect(described_class.new(session).claimed_by_other?(second_browser)).to be(true)
      expect(described_class.new(session).claimed_by_other?(nil)).to be(true)
    end

    it 'reports not in use when Redis is unavailable' do
      allow(redis).to receive(:get).and_raise(Redis::CannotConnectError)

      expect(described_class.new(session).claimed_by_other?(second_browser)).to be(false)
    end
  end
end
