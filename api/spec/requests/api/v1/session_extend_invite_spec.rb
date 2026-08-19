require 'rails_helper'

RSpec.describe 'POST /api/v1/sessions/:id/extend_invite', type: :request do
  let(:organization) { create(:organization) }
  let(:assessment)    { create(:assessment, tenant_id: organization.id) }
  let(:headers)        { assessor_auth_headers(organization) }

  it 'pushes invite_expires_at forward for a pending session' do
    session = create(:session, tenant_id: organization.id, assessment: assessment)

    Timecop.travel(session.invite_expires_at + 1.minute) do
      expect(session.reload.invite_expired?).to be true

      post "/api/v1/sessions/#{session.id}/extend_invite", headers: headers

      expect(response).to have_http_status(:ok)
      expect(session.reload.invite_expired?).to be false
    end
  end

  it 'keeps the same session id and invite_token (no new candidate row)' do
    session = create(:session, tenant_id: organization.id, assessment: assessment)
    original_token = session.invite_token

    post "/api/v1/sessions/#{session.id}/extend_invite", headers: headers

    session.reload
    expect(session.id).to eq(session.id)
    expect(session.invite_token).to eq(original_token)
  end

  it 'refuses to extend a session that is already active (AC-5)' do
    session = create(:session, tenant_id: organization.id, assessment: assessment, status: 'active', started_at: Time.current)

    post "/api/v1/sessions/#{session.id}/extend_invite", headers: headers

    expect(response).to have_http_status(:unprocessable_entity)
  end

  it 'refuses to extend a session that has already ended (AC-5)' do
    session = create(:session, tenant_id: organization.id, assessment: assessment, status: 'ended', started_at: 1.hour.ago, ended_at: Time.current)

    post "/api/v1/sessions/#{session.id}/extend_invite", headers: headers

    expect(response).to have_http_status(:unprocessable_entity)
  end

  it 'requires assessor authentication' do
    session = create(:session, tenant_id: organization.id, assessment: assessment)

    post "/api/v1/sessions/#{session.id}/extend_invite"

    expect(response).to have_http_status(:unauthorized).or have_http_status(:forbidden)
  end
end
