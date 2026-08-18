# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Sessions::EndHandler do
  let(:organization) { create(:organization) }
  let(:assessment) { with_tenant(organization) { create(:assessment) } }
  let!(:skill) { with_tenant(organization) { create(:assessment_skill, assessment: assessment) } }
  let(:session) { with_tenant(organization) { create(:session, assessment: assessment, status: 'active', started_at: 10.minutes.ago) } }

  it 'ends an active session, records duration, and creates a pending portfolio' do
    with_tenant(organization) { described_class.new(session).call(reason: 'all_covered') }

    session.reload
    expect(session).to be_ended
    expect(session.end_reason).to eq('all_covered')
    expect(session.duration_seconds).to be_within(2).of(600)
    expect(session.portfolio).to be_present
    expect(session.portfolio.generation_status).to eq('pending')
    expect(PortfolioGeneratorWorker.jobs.size).to eq(1)
  end

  it 'is idempotent for the same reason' do
    with_tenant(organization) { described_class.new(session).call(reason: 'manual_assessor') }
    expect { with_tenant(organization) { described_class.new(session.reload).call(reason: 'manual_assessor') } }
      .not_to change { PortfolioGeneratorWorker.jobs.size }
  end

  it 'upgrades an error-ended session to a manual reason (candidate/assessor ended cleanly)' do
    session.update!(status: 'ended', end_reason: 'error', ended_at: Time.current)
    described_class.new(session).call(reason: 'manual_candidate')
    expect(session.reload.end_reason).to eq('manual_candidate')
  end

  it 'does not upgrade an error end to all_covered' do
    session.update!(status: 'ended', end_reason: 'error', ended_at: Time.current)
    described_class.new(session).call(reason: 'all_covered')
    expect(session.reload.end_reason).to eq('error')
  end

  it 'defaults unknown reasons to manual_assessor' do
    with_tenant(organization) { described_class.new(session).call(reason: 'some_bogus_reason') }
    expect(session.reload.end_reason).to eq('manual_assessor')
  end
end