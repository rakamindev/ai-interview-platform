# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Sessions::StartHandler do
  it 'activates the session and schedules the time ceiling watchdog' do
    assessment = create(:assessment, time_limit_min: 10)
    session = create(:session, assessment: assessment, tenant_id: assessment.tenant_id, status: 'pending')
    allow(SessionTimeCeilingWorker).to receive(:perform_in)
    allow_any_instance_of(Redis).to receive(:publish)

    described_class.new(session).call

    expect(session.reload.status).to eq('active')
    expect(session.reload.started_at).not_to be_nil
    # limit (10 min) + 60s grace for the WebSocket wrap-up path
    expect(SessionTimeCeilingWorker).to have_received(:perform_in).with(10 * 60 + 60, session.id)
  end
end
