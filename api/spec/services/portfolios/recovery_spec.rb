# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Portfolios::Recovery do
  subject(:recovery) { described_class.new }

  let(:assessment) { create(:assessment) }

  def make_session
    create(:session, assessment: assessment)
  end

  def enqueued
    Sidekiq::Job.jobs.select { |j| j['class'] == 'PortfolioGeneratorWorker' }.flat_map { |j| j['args'] }
  end

  describe '#recover_stuck!' do
    it 'does not recover a fresh pending portfolio' do
      portfolio = create(:portfolio, session: make_session, generation_status: 'pending')

      expect(recovery.recover_stuck!(portfolio)).to be(false)
      expect(enqueued).to be_empty
    end

    it 'recovers a pending portfolio older than the TTL' do
      session   = make_session
      portfolio = create(:portfolio, session: session, generation_status: 'pending')
      Timecop.freeze(30.minutes.ago) { portfolio.update!(created_at: 30.minutes.ago) }
      portfolio.reload

      expect(recovery.recover_stuck!(portfolio)).to be(true)

      expect(portfolio.reload.generation_status).to eq('pending')
      expect(portfolio.reload.generation_attempted_at).not_to be_nil
      expect(enqueued).to eq([session.id])
    end

    it 'does not recover a generating portfolio that started recently' do
      portfolio = create(:portfolio, session: make_session, generation_status: 'generating',
                                     generation_attempted_at: 1.minute.ago)

      expect(recovery.recover_stuck!(portfolio)).to be(false)
      expect(enqueued).to be_empty
    end

    it 'recovers a generating portfolio that started before the TTL' do
      session   = make_session
      portfolio = create(:portfolio, session: session, generation_status: 'generating',
                                     generation_attempted_at: 20.minutes.ago)

      expect(recovery.recover_stuck!(portfolio)).to be(true)
      expect(portfolio.reload.generation_status).to eq('pending')
      expect(enqueued).to eq([session.id])
    end

    it 'does not touch a failed or complete portfolio' do
      failed   = create(:portfolio, session: make_session, generation_status: 'failed')
      complete = create(:portfolio, session: make_session, generation_status: 'complete')

      expect(recovery.recover_stuck!(failed)).to be(false)
      expect(recovery.recover_stuck!(complete)).to be(false)
      expect(enqueued).to be_empty
    end

    it 'is idempotent across sweeps (second recovery skips because the clock was refreshed)' do
      session   = make_session
      portfolio = create(:portfolio, session: session, generation_status: 'pending')
      Timecop.freeze(20.minutes.ago) { portfolio.update!(created_at: 20.minutes.ago) }
      portfolio.reload

      expect(recovery.recover_stuck!(portfolio)).to be(true)
      expect(enqueued).to eq([session.id])

      # A concurrent/second sweep (same threshold) must NOT re-enqueue
      expect(recovery.recover_stuck!(portfolio.reload)).to be(false)
      expect(enqueued).to eq([session.id])
    end

    it 'returns false and does not raise when the worker enqueue fails' do
      broken_worker = Class.new { \
        def self.perform_async(*) = raise(Redis::CannotConnectError, 'down') \
      }
      local = described_class.new(worker_class: broken_worker)

      portfolio = create(:portfolio, session: make_session, generation_status: 'pending')
      Timecop.freeze(30.minutes.ago) { portfolio.update!(created_at: 30.minutes.ago) }
      portfolio.reload

      expect(local.recover_stuck!(portfolio)).to be(false)
      expect(Portfolio.find(portfolio.id).generation_status).to eq('pending')
    end
  end

  describe '#recover!' do
    it 'returns only the portfolios it re-enqueued' do
      stuck_pending = create(:portfolio, session: make_session, generation_status: 'pending')
      Timecop.freeze(30.minutes.ago) { stuck_pending.update!(created_at: 30.minutes.ago) }
      sticky_generating = create(:portfolio, session: make_session, generation_status: 'generating',
                                             generation_attempted_at: 20.minutes.ago)
      healthy = create(:portfolio, session: make_session, generation_status: 'generating',
                                   generation_attempted_at: 1.minute.ago)

      recovered = recovery.recover!

      expect(recovered.map(&:id))
        .to contain_exactly(stuck_pending.id, sticky_generating.id)
      expect(recovered.map(&:id)).not_to include(healthy.id)
      expect(enqueued).to match_array([stuck_pending.session_id, sticky_generating.session_id])
    end
  end
end