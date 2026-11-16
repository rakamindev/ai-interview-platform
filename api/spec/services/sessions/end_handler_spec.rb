# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Sessions::EndHandler do
  let(:session) { create(:session, status: 'active', started_at: 2.minutes.ago) }
  let(:redis) { instance_double(Redis, publish: 1, close: nil) }

  before do
    allow(Redis).to receive(:new).and_return(redis)
    allow(PortfolioGeneratorWorker).to receive(:perform_async)
  end

  it 'ends a session, records duration, creates a portfolio and enqueues generation' do
    described_class.new(session).call(reason: 'manual_candidate')

    session.reload
    expect(session).to be_ended
    expect(session.end_reason).to eq('manual_candidate')
    expect(session.ended_at).to be_present
    expect(session.duration_seconds).to be >= 120
    expect(session.portfolio).to be_present
    expect(session.portfolio.generation_status).to eq('pending')
    expect(PortfolioGeneratorWorker).to have_received(:perform_async).with(session.id)
  end

  it 'normalizes an invalid end reason to manual_assessor' do
    described_class.new(session).call(reason: 'not-a-valid-reason')

    expect(session.reload.end_reason).to eq('manual_assessor')
  end

  it 'does not create another portfolio or enqueue generation on repeated calls' do
    handler = described_class.new(session)
    handler.call
    portfolio_id = session.reload.portfolio.id

    handler.call

    expect(session.reload.portfolio.id).to eq(portfolio_id)
    expect(PortfolioGeneratorWorker).to have_received(:perform_async).once
  end

  it 'upgrades an error end reason when a candidate ends cleanly afterward' do
    ended_session = create(:session, status: 'ended', end_reason: 'error')
    described_class.new(ended_session).call(reason: 'manual_candidate')

    expect(ended_session.reload.end_reason).to eq('manual_candidate')
  end
end
