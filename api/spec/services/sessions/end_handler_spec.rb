# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Sessions::EndHandler do
  let(:organization) do
    Organization.create!(name: 'Test Corp', scheme: 'test-corp', identifier: 'test-corp', host: 'test.example.test')
  end
  let(:assessment) do
    Assessment.unscoped.create!(
      tenant_id: organization.id, created_by: 1, name: 'Reconnect', time_limit_min: 45, language: 'en'
    )
  end
  let(:session) { Session.unscoped.create!(tenant_id: organization.id, assessment: assessment, status: 'active') }

  before { allow(PortfolioGeneratorWorker).to receive(:perform_async) }

  context 'when called on behalf of an audio connection' do
    before { session.claim_audio_connection!('owner') }

    it 'ends the session for the owning connection' do
      described_class.new(session).call(reason: 'error', connection_id: 'owner')

      expect(session.reload).to be_ended
      expect(PortfolioGeneratorWorker).to have_received(:perform_async).with(session.id)
    end

    it 'does nothing for a replaced connection, even with a stale in-memory record' do
      stale_copy = Session.unscoped.find(session.id)
      session.claim_audio_connection!('new-owner')

      described_class.new(stale_copy).call(reason: 'error', connection_id: 'owner')

      expect(session.reload).to be_active
      expect(session.portfolio).to be_nil
      expect(PortfolioGeneratorWorker).not_to have_received(:perform_async)
    end
  end

  it 'ends regardless of connection when no connection is given (assessor, audio_complete)' do
    session.claim_audio_connection!('owner')

    described_class.new(session).call(reason: 'manual_assessor')

    expect(session.reload).to be_ended
  end

  it 'records when generation was requested, so the wait survives page refreshes' do
    described_class.new(session).call(reason: 'all_covered')

    expect(session.reload.portfolio.generation_requested_at).to be_within(1.minute).of(Time.current)
  end

  it 'enqueues a single portfolio when two callers race with stale records' do
    stale_copy = Session.unscoped.find(session.id)

    described_class.new(session).call(reason: 'all_covered')
    described_class.new(stale_copy).call(reason: 'error')

    expect(session.reload.end_reason).to eq('all_covered')
    expect(PortfolioGeneratorWorker).to have_received(:perform_async).once
  end
end
