# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Sessions::EndHandler do
  around do |example|
    Current.using(tenant_id: 1) { example.run }
  end

  let(:assessment) do
    Assessment.create!(name: 'Backend Intern', time_limit_min: 30, created_by: 1)
  end
  let(:session) do
    Session.create!(assessment: assessment, status: 'active', started_at: 5.minutes.ago)
  end

  before do
    allow_any_instance_of(described_class).to receive(:publish_status_update)
  end

  describe '#call' do
    context 'when the job queue is unavailable' do
      before do
        allow(PortfolioGeneratorWorker).to receive(:perform_async)
          .and_raise(RedisClient::CannotConnectError, 'Connection refused - redis://localhost:6379/1')
      end

      it 'still ends the session without raising' do
        expect { described_class.new(session).call(reason: 'all_covered') }.not_to raise_error
        expect(session.reload.status).to eq('ended')
      end

      it 'marks the portfolio as failed instead of leaving it pending forever' do
        described_class.new(session).call(reason: 'all_covered') rescue nil
        portfolio = session.reload.portfolio

        expect(portfolio.generation_status).to eq('failed')
        expect(portfolio.generation_error).to be_present
      end

      it 'does not leak infrastructure details in the stored error' do
        described_class.new(session).call(reason: 'all_covered') rescue nil
        error = session.reload.portfolio.generation_error.to_s
        expect(error).to be_present

        expect(error).not_to include('redis://')
        expect(error).not_to include('localhost')
      end
    end

    context 'when the job queue is available' do
      it 'enqueues exactly one generation job and keeps the portfolio pending' do
        expect(PortfolioGeneratorWorker).to receive(:perform_async).with(session.id).once

        described_class.new(session).call(reason: 'all_covered')

        expect(session.reload.portfolio.generation_status).to eq('pending')
      end
    end
  end
end
