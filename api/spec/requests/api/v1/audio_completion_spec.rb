# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Candidate audio completion', type: :request do
  let!(:organization) do
    Organization.create!(
      name: 'Test Organization', scheme: 'test-org', identifier: 'test-org', host: 'test-org.local'
    )
  end
  let!(:assessment) do
    Assessment.unscoped.create!(tenant_id: organization.id, created_by: 1, name: 'Backend Engineer', time_limit_min: 30)
  end
  let!(:session) do
    Session.unscoped.create!(
      tenant_id: organization.id,
      assessment: assessment,
      status: 'active',
      started_at: Time.current
    )
  end

  def complete_audio(session)
    post "/api/v1/sessions/#{session.invite_token}/audio_complete"
  end

  it 'rejects a browser completion request before the server authorizes it' do
    complete_audio(session)

    expect(response).to have_http_status(:unprocessable_entity)
    expect(session.reload.status).to eq('active')
    expect(Portfolio.where(session_id: session.id)).not_to exist
  end

  it 'ends an authorized session once when the browser retries the request' do
    session.update!(completion_authorized_at: Time.current)
    allow(PortfolioGeneratorWorker).to receive(:perform_async)

    complete_audio(session)
    complete_audio(session)

    expect(response).to have_http_status(:ok)
    expect(session.reload.status).to eq('ended')
    expect(session.end_reason).to eq('all_covered')
    expect(Portfolio.where(session_id: session.id).count).to eq(1)
    expect(PortfolioGeneratorWorker).to have_received(:perform_async).once.with(session.id)
  end

  it 'does not turn a provider failure into a completed interview' do
    session.mark_failed!(code: 'gemini_connection_failed')

    complete_audio(session)

    expect(response).to have_http_status(:unprocessable_entity)
    expect(session.reload.status).to eq('failed')
    expect(Portfolio.where(session_id: session.id)).not_to exist
  end
end
