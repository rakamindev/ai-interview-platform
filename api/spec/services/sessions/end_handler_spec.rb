# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Sessions::EndHandler do
  subject(:handler) { described_class.new(session) }

  let(:assessment) { create(:assessment, name: 'Backend Engineer') }
  let(:session)    { create(:session, assessment: assessment, status: 'pending', started_at: 15.minutes.ago) }

  def enqueued_jobs
    Sidekiq::Job.jobs.select { |j| j['class'] == 'PortfolioGeneratorWorker' }
  end

  describe '#call' do
    it 'ends the session and creates a pending portfolio' do
      result = handler.call(reason: 'manual_assessor')

      expect(session.reload.status).to eq('ended')
      expect(session.reload.end_reason).to eq('manual_assessor')
      expect(session.reload.ended_at).not_to be_nil
      expect(session.reload.duration_seconds).not_to be_nil

      portfolio = session.reload.portfolio
      expect(portfolio).to be_present
      expect(portfolio.generation_status).to eq('pending')
      expect(result).to eq(session)
    end

    it 'enqueues exactly one portfolio generation job' do
      handler.call(reason: 'manual_assessor')

      expect(enqueued_jobs.size).to eq(1)
      expect(enqueued_jobs.first['args']).to eq([session.id])
    end

    it 'coerces an invalid reason to manual_assessor' do
      handler.call(reason: 'bogus')

      expect(session.reload.end_reason).to eq('manual_assessor')
    end

    it 'is idempotent: a second call does not create another portfolio or enqueue again' do
      2.times { handler.call(reason: 'manual_assessor') }

      expect(session.reload.portfolio).to be_present
      expect(Portfolio.count).to eq(1)
      expect(enqueued_jobs.size).to eq(1)
    end

    it 'upgrades an earlier terminal error reason to a manual reason' do
      session.update!(status: 'ended', end_reason: 'error')

      handler.call(reason: 'manual_candidate')

      expect(session.reload.end_reason).to eq('manual_candidate')
      expect(enqueued_jobs).to be_empty
    end

    it 'does not 500 the caller when the job enqueue fails (recovery will retry)' do
      expect(PortfolioGeneratorWorker).to receive(:perform_async)
                                            .and_raise(Redis::CannotConnectError.new('down'))

      expect { handler.call(reason: 'manual_assessor') }.not_to raise_error
      # Session is still properly ended and a portfolio exists, so a later sweep
      # can pick it up.
      expect(session.reload.status).to eq('ended')
      expect(session.reload.portfolio.generation_status).to eq('pending')
    end

    it 'serializes concurrent end calls so only one portfolio and one job are produced', cleaner_strategy: :truncation do
      threads = 2.times.map do
        Thread.new { handler.call(reason: 'manual_assessor') }
      end

      threads.each(&:join)
      results = threads.map(&:value)
      expect(results.size).to eq(2)

      session.reload
      expect(session.status).to eq('ended')
      expect(session.portfolio).to be_present
      expect(Portfolio.count).to eq(1)
      expect(enqueued_jobs.size).to eq(1)
    end
  end
end