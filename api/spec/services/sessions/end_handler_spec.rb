# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Sessions::EndHandler do
  # We need a real database session for this test.
  # Since we are in unit test context, we stub the DB calls and verify the transaction logic.

  let(:session) do
    instance_double(
      Session,
      id:          42,
      ended?:      false,
      end_reason:  nil,
      started_at:  1.hour.ago,
      candidate_id: 7,
      portfolio:   nil
    )
  end

  subject { described_class.new(session) }

  describe '#call' do
    context 'when session is already ended' do
      let(:session) do
        instance_double(Session, id: 42, ended?: true, end_reason: 'error')
      end

      it 'returns the session without making further changes' do
        expect(session).not_to receive(:update!)
        result = subject.call(reason: 'manual_candidate')
        expect(result).to eq(session)
      end
    end

    context 'when session is active' do
      before do
        allow(session).to receive(:update!).and_return(true)
        allow(session).to receive(:create_portfolio!).and_return(true)
        allow(session).to receive(:reload).and_return(session)
        allow(session).to receive(:portfolio).and_return(nil)
        allow(ActiveRecord::Base).to receive(:transaction).and_yield
        allow(PortfolioGeneratorWorker).to receive(:perform_async)
        redis_double = instance_double(Redis, publish: nil, close: nil)
        allow(Redis).to receive(:new).and_return(redis_double)
      end

      it 'wraps session update and portfolio creation in a transaction' do
        expect(ActiveRecord::Base).to receive(:transaction).and_yield
        subject.call(reason: 'all_covered')
      end

      it 'updates session status to ended' do
        expect(session).to receive(:update!).with(
          hash_including(status: 'ended', end_reason: 'all_covered')
        )
        subject.call(reason: 'all_covered')
      end

      it 'uses manual_assessor as default for invalid reasons' do
        expect(session).to receive(:update!).with(
          hash_including(end_reason: 'manual_assessor')
        )
        subject.call(reason: 'invalid_reason')
      end
    end
  end
end
