# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Sessions::StartHandler do
  let(:organization) do
    Organization.create!(name: 'Test Corp', scheme: 'test-corp', identifier: 'test-corp', host: 'test.example.test')
  end
  let(:assessment) do
    Assessment.unscoped.create!(
      tenant_id: organization.id, created_by: 1, name: 'Start', time_limit_min: 45, language: 'en'
    )
  end
  let(:session) { Session.unscoped.create!(tenant_id: organization.id, assessment: assessment) }

  it 'activates a pending session for the owning connection' do
    session.claim_audio_connection!('owner')

    described_class.new(session).call(connection_id: 'owner')

    expect(session.reload).to be_active
    expect(session.started_at).to be_present
  end

  it 'does nothing for a replaced connection, even with a stale record' do
    stale_copy = Session.unscoped.find(session.id)
    session.claim_audio_connection!('new-owner')

    described_class.new(stale_copy).call(connection_id: 'old-owner')

    expect(session.reload).to be_pending
    expect(session.started_at).to be_nil
  end

  it 'keeps the original start time when called for a session already running' do
    session.claim_audio_connection!('owner')
    described_class.new(session).call(connection_id: 'owner')
    started_at = session.reload.started_at

    described_class.new(Session.unscoped.find(session.id)).call(connection_id: 'owner')

    expect(session.reload.started_at).to eq(started_at)
  end

  it 'does not reopen a session that already ended' do
    session.update!(status: 'ended', end_reason: 'error')

    described_class.new(session).call

    expect(session.reload).to be_ended
  end
end
