require 'rails_helper'

# Covers the P1 fix: FitGapReportPage polled every 5s while a report was
# generating, 404'd on every tick until the row existed, and the 404 handler
# re-fired POST /fitgap on each one — with no in-flight guard, every poll
# tick enqueued another FitGapGeneratorWorker racing to write the same report.
# `enqueue_unless_running` closes that with a per-(portfolio, vacancy) Redis
# NX lock, released in `perform`'s ensure regardless of outcome.
RSpec.describe FitGapGeneratorWorker do
  let(:session)   { create(:session, status: 'ended') }
  let(:portfolio) { create(:portfolio, session: session, generation_status: 'complete') }
  let(:vacancy)   { create(:vacancy) }
  let(:engine_double) { instance_double(FitGap::Engine, call: build(:fit_gap_report)) }

  describe '.enqueue_unless_running' do
    it 'enqueues the job and returns true when no generation is in flight' do
      expect(
        described_class.enqueue_unless_running(portfolio.id, vacancy.id, 'manual_regeneration')
      ).to eq(true)

      expect(described_class.jobs.size).to eq(1)
      expect(described_class.jobs.last['args']).to eq([portfolio.id, vacancy.id, 'manual_regeneration'])
    end

    it 'is a no-op and returns false while a generation for the same pair is already locked' do
      described_class.enqueue_unless_running(portfolio.id, vacancy.id)
      described_class.jobs.clear # simulate: first job already picked up, lock still held

      expect(
        described_class.enqueue_unless_running(portfolio.id, vacancy.id, 'manual_regeneration')
      ).to eq(false)
      expect(described_class.jobs).to be_empty
    end

    it 'allows a new generation once the previous lock has been released' do
      described_class.enqueue_unless_running(portfolio.id, vacancy.id)
      Sidekiq.redis { |c| c.del(described_class.lock_key(portfolio.id, vacancy.id)) }

      expect(
        described_class.enqueue_unless_running(portfolio.id, vacancy.id)
      ).to eq(true)
    end
  end

  describe '#perform' do
    it 'invokes FitGap::Engine with the given trigger_reason and releases the lock' do
      Sidekiq.redis { |c| c.set(described_class.lock_key(portfolio.id, vacancy.id), 1, nx: true) }

      expect(FitGap::Engine).to receive(:new)
        .with(portfolio: portfolio, vacancy: vacancy, trigger_reason: 'assessor_override_update')
        .and_return(engine_double)

      described_class.new.perform(portfolio.id, vacancy.id, 'assessor_override_update')

      expect(Sidekiq.redis { |c| c.get(described_class.lock_key(portfolio.id, vacancy.id)) }).to be_nil
    end

    it 'releases the lock even when the engine raises, so a failed run does not wedge future generations' do
      Sidekiq.redis { |c| c.set(described_class.lock_key(portfolio.id, vacancy.id), 1, nx: true) }
      allow(FitGap::Engine).to receive(:new).and_raise(StandardError, 'gemini timeout')

      expect { described_class.new.perform(portfolio.id, vacancy.id) }.to raise_error(StandardError)
      expect(Sidekiq.redis { |c| c.get(described_class.lock_key(portfolio.id, vacancy.id)) }).to be_nil
    end
  end
end
