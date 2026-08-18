# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Sessions::EndHandler do
  let(:org)     { create(:organization) }
  let(:session) { create(:session, organization: org, status: 'active', started_at: 5.minutes.ago) }

  before do
    allow(PortfolioGeneratorWorker).to receive(:perform_async)
    allow(::Redis).to receive(:new).and_return(instance_double(Redis, publish: 1, close: nil))
  end

  context 'with transcript turns (real interview happened)' do
    before { create(:transcript_turn, session: session) }

    it 'marks the session ended with the given reason and enqueues portfolio generation' do
      described_class.new(session).call(reason: 'manual_candidate')

      expect(session.reload.status).to eq('ended')
      expect(session.end_reason).to eq('manual_candidate')
      expect(session.portfolio).to be_present
      expect(PortfolioGeneratorWorker).to have_received(:perform_async).with(session.id)
    end
  end

  context 'with zero transcript turns (interview never happened)' do
    it 'marks the session failed with end_reason error' do
      described_class.new(session).call(reason: 'manual_candidate')

      expect(session.reload.status).to eq('failed')
      expect(session.end_reason).to eq('error')
    end

    it 'does not create a portfolio or enqueue generation' do
      described_class.new(session).call(reason: 'all_covered')

      expect(session.reload.portfolio).to be_nil
      expect(PortfolioGeneratorWorker).not_to have_received(:perform_async)
    end
  end

  context 'when the session is already terminal' do
    it 'is idempotent for ended sessions' do
      create(:transcript_turn, session: session)
      described_class.new(session).call(reason: 'all_covered')

      expect { described_class.new(session.reload).call(reason: 'manual_assessor') }
        .not_to change { session.reload.end_reason }
    end

    it 'does not re-process failed sessions' do
      described_class.new(session).call(reason: 'all_covered') # fails (no turns)
      create(:transcript_turn, session: session)

      described_class.new(session.reload).call(reason: 'all_covered')
      expect(session.reload.status).to eq('failed')
      expect(PortfolioGeneratorWorker).not_to have_received(:perform_async)
    end
  end
end