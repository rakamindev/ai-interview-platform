# frozen_string_literal: true

require 'rails_helper'

# audio_complete is the unauthenticated (invite-token only) session-ending
# endpoint. It must never label an incomplete interview as fully covered, and
# must not end sessions that are already failed.
RSpec.describe 'Audio complete', type: :request do
  def stub_background_work
    allow(PortfolioGeneratorWorker).to receive(:perform_async)
    allow_any_instance_of(Redis).to receive(:publish)
  end

  it 'returns 404 for an unknown token' do
    post '/api/v1/sessions/deadbeef/audio_complete'

    expect(response).to have_http_status(:not_found)
  end

  it 'is idempotent for an already-ended session' do
    session = create(:session, status: 'ended', end_reason: 'all_covered')

    post "/api/v1/sessions/#{session.invite_token}/audio_complete"

    expect(response).to have_http_status(:ok)
    expect(session.reload.end_reason).to eq('all_covered')
  end

  it 'ends an active session as all_covered when coverage is complete' do
    assessment = create(:assessment, time_limit_min: 10)
    session = create(:session, assessment: assessment, tenant_id: assessment.tenant_id,
                               status: 'active', started_at: 1.minute.ago)
    create(:coverage_map, session: session, skill_label: 'Ruby', state: 'covered', is_discovered: false)
    stub_background_work

    post "/api/v1/sessions/#{session.invite_token}/audio_complete"

    expect(response).to have_http_status(:ok)
    expect(session.reload).to be_ended
    expect(session.reload.end_reason).to eq('all_covered')
  end

  it 'labels an early end as manual_candidate instead of dishonest all_covered' do
    assessment = create(:assessment, time_limit_min: 10)
    session = create(:session, assessment: assessment, tenant_id: assessment.tenant_id,
                               status: 'active', started_at: 1.minute.ago)
    create(:coverage_map, session: session, skill_label: 'Ruby', state: 'not_yet', is_discovered: false)
    stub_background_work

    post "/api/v1/sessions/#{session.invite_token}/audio_complete"

    expect(response).to have_http_status(:ok)
    expect(session.reload).to be_ended
    expect(session.reload.end_reason).to eq('manual_candidate')
  end

  it 'does not end a failed session' do
    session = create(:session, status: 'failed')
    stub_background_work

    post "/api/v1/sessions/#{session.invite_token}/audio_complete"

    expect(response).to have_http_status(:unprocessable_entity)
    expect(session.reload.status).to eq('failed')
  end
end
