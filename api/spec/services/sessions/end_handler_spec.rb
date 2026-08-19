# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Sessions::EndHandler do
  let(:session) { create(:session, status: 'active', started_at: 10.minutes.ago) }
  let(:handler) { described_class.new(session) }
  let(:redis_double) { instance_double(::Redis, publish: true, close: true) }

  before do
    allow(::Redis).to receive(:new).and_return(redis_double)
    allow(PortfolioGeneratorWorker).to receive(:perform_async)
  end

  describe '#call' do
    context 'when ending an active session' do
      it 'ends the session with the provided reason' do
        handler.call(reason: 'manual_candidate')
        
        session.reload
        expect(session.status).to eq('ended')
        expect(session.end_reason).to eq('manual_candidate')
        expect(session.ended_at).to be_present
        expect(session.duration_seconds).to be > 0
      end

      it 'defaults to manual_assessor if reason is invalid' do
        handler.call(reason: 'invalid_reason')
        
        expect(session.reload.end_reason).to eq('manual_assessor')
      end

      it 'creates a pending portfolio' do
        expect { handler.call }.to change(Portfolio, :count).by(1)
        
        portfolio = session.reload.portfolio
        expect(portfolio.generation_status).to eq('pending')
      end

      it 'enqueues PortfolioGeneratorWorker' do
        expect(PortfolioGeneratorWorker).to receive(:perform_async).with(session.id)
        handler.call
      end

      it 'publishes status update to redis' do
        expect(redis_double).to receive(:publish).with("coverage:#{session.id}", anything)
        handler.call
      end
    end

    context 'when session already has a portfolio (idempotent)' do
      let!(:existing_portfolio) { create(:portfolio, session: session, generation_status: 'failed') }

      it 'does not create another portfolio' do
        expect { handler.call }.not_to change(Portfolio, :count)
      end

      it 'still enqueues the worker' do
        expect(PortfolioGeneratorWorker).to receive(:perform_async).with(session.id)
        handler.call
      end
    end

    context 'when session is already ended' do
      before do
        session.update!(status: 'ended', end_reason: 'error', ended_at: 1.minute.ago)
      end

      it 'allows upgrading error to manual reason' do
        handler.call(reason: 'manual_assessor')
        expect(session.reload.end_reason).to eq('manual_assessor')
      end

      it 'does not upgrade if reason is not manual' do
        handler.call(reason: 'time_ceiling')
        expect(session.reload.end_reason).to eq('error')
      end

      it 'does not create portfolio or enqueue worker' do
        expect { handler.call }.not_to change(Portfolio, :count)
        expect(PortfolioGeneratorWorker).not_to receive(:perform_async)
      end
    end

    context 'when redis fails' do
      it 'rescues the error and still completes termination' do
        allow(redis_double).to receive(:publish).and_raise(StandardError, 'Redis failure')

        expect { handler.call }.not_to raise_error
        expect(session.reload.status).to eq('ended')
      end
    end
  end
end
