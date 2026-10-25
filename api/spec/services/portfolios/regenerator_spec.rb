# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Portfolios::Regenerator do
  around do |example|
    Current.using(tenant_id: 1) { example.run }
  end

  let(:assessment) { Assessment.create!(name: 'Backend Intern', time_limit_min: 30, created_by: 1) }
  let(:session)    { Session.create!(assessment: assessment, status: 'ended', end_reason: 'all_covered') }

  def portfolio_with(status:, changed_at: 1.minute.ago, error: nil)
    portfolio = Portfolio.create!(session: session, generation_status: status, generation_error: error)
    portfolio.update_column(:status_changed_at, changed_at)
    portfolio
  end

  describe '#call' do
    context 'when the portfolio failed' do
      let(:portfolio) { portfolio_with(status: 'failed', error: 'Gemini API timeout after 180s') }

      it 'queues one job, resets the status and clears the old error' do
        expect(PortfolioGeneratorWorker).to receive(:perform_async).with(session.id).once

        described_class.new(portfolio).call

        expect(portfolio.reload).to have_attributes(generation_status: 'pending', generation_error: nil)
      end
    end

    context 'when the portfolio is stale (pending for too long)' do
      let(:portfolio) { portfolio_with(status: 'pending', changed_at: 11.minutes.ago) }

      it 'queues a new job' do
        expect(PortfolioGeneratorWorker).to receive(:perform_async).with(session.id).once

        described_class.new(portfolio).call

        expect(portfolio.reload.generation_status).to eq('pending')
        expect(portfolio.stale?).to be(false)
      end
    end

    context 'when the portfolio is still fresh or already complete' do
      %w[pending generating complete].each do |status|
        it "refuses a #{status} portfolio and queues nothing" do
          portfolio = portfolio_with(status: status, changed_at: 1.minute.ago)
          expect(PortfolioGeneratorWorker).not_to receive(:perform_async)

          expect { described_class.new(portfolio).call }
            .to raise_error(Portfolios::Regenerator::NotRegenerable)
          expect(portfolio.reload.generation_status).to eq(status)
        end
      end
    end

    context 'when called twice in a row' do
      it 'queues only one job' do
        portfolio = portfolio_with(status: 'failed')
        expect(PortfolioGeneratorWorker).to receive(:perform_async).once

        described_class.new(portfolio).call

        expect { described_class.new(portfolio.reload).call }
          .to raise_error(Portfolios::Regenerator::NotRegenerable)
      end
    end

    context 'when the job queue is unavailable' do
      it 'marks the portfolio failed with a safe message and raises QueueUnavailable' do
        portfolio = portfolio_with(status: 'failed')
        allow(PortfolioGeneratorWorker).to receive(:perform_async)
          .and_raise(RedisClient::CannotConnectError, 'Connection refused - redis://localhost:6379/1')

        expect { described_class.new(portfolio).call }
          .to raise_error(Portfolios::Regenerator::QueueUnavailable)

        portfolio.reload
        expect(portfolio.generation_status).to eq('failed')
        expect(portfolio.generation_error).to be_present
        expect(portfolio.generation_error).not_to include('redis://')
      end
    end
  end
end
