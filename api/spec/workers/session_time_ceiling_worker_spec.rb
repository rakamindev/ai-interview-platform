# frozen_string_literal: true

require 'rails_helper'

# Server-side time ceiling: a silent candidate or stalled model must not be
# able to run past the advertised time limit — the WebSocket only enforces the
# ceiling on transcription events, so a dedicated watchdog job covers silence.
RSpec.describe SessionTimeCeilingWorker do
  def stub_background_work
    allow(PortfolioGeneratorWorker).to receive(:perform_async)
    allow_any_instance_of(Redis).to receive(:publish)
  end

  it 'ends an active session that passed its time limit with reason time_ceiling' do
    assessment = create(:assessment, time_limit_min: 10)
    session = create(:session, assessment: assessment, tenant_id: assessment.tenant_id,
                               status: 'active', started_at: 20.minutes.ago)
    stub_background_work

    described_class.new.perform(session.id)

    expect(session.reload).to be_ended
    expect(session.reload.end_reason).to eq('time_ceiling')
  end

  it 'does nothing before the limit is reached' do
    assessment = create(:assessment, time_limit_min: 10)
    session = create(:session, assessment: assessment, tenant_id: assessment.tenant_id,
                               status: 'active', started_at: 2.minutes.ago)

    described_class.new.perform(session.id)

    expect(session.reload).not_to be_ended
  end

  it 'does nothing for an already-ended session' do
    assessment = create(:assessment, time_limit_min: 10)
    session = create(:session, assessment: assessment, tenant_id: assessment.tenant_id,
                               status: 'ended', started_at: 20.minutes.ago, ended_at: Time.current)

    described_class.new.perform(session.id)

    expect(session.reload.status).to eq('ended')
  end

  it 'does nothing when the session never started' do
    session = create(:session, status: 'active', started_at: nil)

    described_class.new.perform(session.id)

    expect(session.reload).not_to be_ended
  end
end
