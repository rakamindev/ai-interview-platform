# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::Sessions', type: :request do
  let!(:org_a) do
    Organization.create!(
      name: 'Tenant A',
      scheme: 'tenant-a',
      identifier: 'tenant-a',
      host: 'tenant-a.com'
    )
  end

  let!(:org_b) do
    Organization.create!(
      name: 'Tenant B',
      scheme: 'tenant-b',
      identifier: 'tenant-b',
      host: 'tenant-b.com'
    )
  end

  let(:token_a) { JsonWebToken.encode({ user_id: 101, role: 'admin', scheme: 'tenant-a' }) }
  let(:token_b) { JsonWebToken.encode({ user_id: 102, role: 'admin', scheme: 'tenant-b' }) }

  let(:headers_a) { { 'Authorization' => "Bearer #{token_a}" } }
  let(:headers_b) { { 'Authorization' => "Bearer #{token_b}" } }

  let!(:assessment_a) { Assessment.create!(tenant_id: org_a.id, name: 'Assess A', time_limit_min: 30, created_by: 101) }
  let!(:assessment_b) { Assessment.create!(tenant_id: org_b.id, name: 'Assess B', time_limit_min: 30, created_by: 102) }

  let!(:session_a) do
    Session.create!(
      tenant_id: org_a.id,
      assessment: assessment_a,
      invite_token: 'token-a-session',
      status: 'active'
    )
  end

  let!(:session_b) do
    Session.create!(
      tenant_id: org_b.id,
      assessment: assessment_b,
      invite_token: 'token-b-session',
      status: 'active'
    )
  end

  describe 'GET /api/v1/sessions/:id' do
    context 'when authenticated as Tenant A' do
      it 'allows viewing its own session' do
        get "/api/v1/sessions/#{session_a.id}", headers: headers_a
        expect(response).to have_http_status(:ok)
      end

      it 'blocks viewing Tenant B session' do
        get "/api/v1/sessions/#{session_b.id}", headers: headers_a
        expect(response).to have_http_status(:not_found).or(have_http_status(:forbidden))
      end
    end
  end

  describe 'POST /api/v1/sessions/:id/end_session' do
    context 'when authenticated as Tenant A' do
      it 'allows ending its own session' do
        post "/api/v1/sessions/#{session_a.id}/end_session", headers: headers_a
        expect(response).to have_http_status(:ok)
      end

      it 'blocks ending Tenant B session' do
        post "/api/v1/sessions/#{session_b.id}/end_session", headers: headers_a
        expect(response).to have_http_status(:not_found).or(have_http_status(:forbidden))
      end
    end
  end

  describe 'GET /api/v1/sessions/:id/transcript' do
    context 'when authenticated as Tenant A' do
      it 'allows viewing its own session transcript' do
        get "/api/v1/sessions/#{session_a.id}/transcript", headers: headers_a
        expect(response).to have_http_status(:ok)
      end

      it 'blocks viewing Tenant B session transcript' do
        get "/api/v1/sessions/#{session_b.id}/transcript", headers: headers_a
        expect(response).to have_http_status(:not_found).or(have_http_status(:forbidden))
      end
    end
  end

  describe 'POST /api/v1/sessions/:id/resolve' do
    context 'when authenticated as Tenant A' do
      before { session_a.update!(audit_status: 'objection_filed') }

      it 'resolves the objection successfully' do
        post "/api/v1/sessions/#{session_a.id}/resolve", params: { resolution: { notes: 'Approved overrides' } }, headers: headers_a
        expect(response).to have_http_status(:ok)
        expect(session_a.reload.audit_status).to eq('resolved')
        expect(session_a.resolution_notes).to eq('Approved overrides')
      end

      it 'returns error if notes are empty' do
        post "/api/v1/sessions/#{session_a.id}/resolve", params: { resolution: { notes: '' } }, headers: headers_a
        expect(response).to have_http_status(:unprocessable_entity)
      end

      it 'blocks resolving Tenant B session' do
        session_b.update!(audit_status: 'objection_filed')
        post "/api/v1/sessions/#{session_b.id}/resolve", params: { resolution: { notes: 'Approved' } }, headers: headers_a
        expect(response).to have_http_status(:not_found).or(have_http_status(:forbidden))
      end
    end
  end

  describe 'POST /api/v1/sessions/:id/retake' do
    context 'when authenticated as Tenant A' do
      before { session_a.update!(audit_status: 'objection_filed') }

      it 'approves a retake and generates a new session' do
        expect {
          post "/api/v1/sessions/#{session_a.id}/retake", headers: headers_a
        }.to change(Session, :count).by(1)

        expect(response).to have_http_status(:ok)
        json = JSON.parse(response.body)
        expect(json['invite_url']).to be_present
        expect(session_a.reload.audit_status).to eq('retake_approved')
      end

      it 'blocks retake for Tenant B session' do
        session_b.update!(audit_status: 'objection_filed')
        post "/api/v1/sessions/#{session_b.id}/retake", headers: headers_a
        expect(response).to have_http_status(:not_found).or(have_http_status(:forbidden))
      end
    end
  end
end
