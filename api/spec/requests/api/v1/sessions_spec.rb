# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::Sessions', type: :request do
  let!(:tenant) do
    Organization.find_by(scheme: 'test_tenant') || Organization.create!(
      name: 'Test Tenant',
      scheme: 'test_tenant',
      identifier: 'test-org-123',
      host: 'test.rakamin.com'
    )
  end

  let!(:other_tenant) do
    Organization.find_by(scheme: 'other_tenant') || Organization.create!(
      name: 'Other Tenant',
      scheme: 'other_tenant',
      identifier: 'other-org-456',
      host: 'other.rakamin.com'
    )
  end

  let(:assessor_token) do
    JsonWebToken.encode(user_id: 42, role: 'assessor', scheme: tenant.scheme)
  end

  let(:auth_headers) do
    {
      'Authorization' => "Bearer #{assessor_token}",
      'Content-Type'  => 'application/json'
    }
  end

  let!(:assessment) do
    Current.organization = tenant
    Current.tenant_id = tenant.id
    Assessment.create!(
      name: 'Senior Backend Engineer',
      time_limit_min: 45,
      tenant_id: tenant.id,
      created_by: 42
    )
  ensure
    Current.clear
  end

  let!(:session_record) do
    Current.organization = tenant
    Current.tenant_id = tenant.id
    assessment.sessions.create!(
      tenant_id: tenant.id,
      candidate_id: 101,
      candidate_name: 'Budi Santoso'
    )
  ensure
    Current.clear
  end

  describe 'PATCH /api/v1/sessions/:id' do
    it 'updates the candidate_name on the session successfully' do
      patch "/api/v1/sessions/#{session_record.id}",
            params: { session: { candidate_name: 'Dewi Lestari' } }.to_json,
            headers: auth_headers

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json['session']['candidate_name']).to eq('Dewi Lestari')
      expect(session_record.reload.candidate_name).to eq('Dewi Lestari')
    end

    it 'rejects requests with missing or invalid authentication token' do
      patch "/api/v1/sessions/#{session_record.id}",
            params: { session: { candidate_name: 'Hacker' } }.to_json,
            headers: {
              'X-Tenant-Scheme' => tenant.scheme,
              'Content-Type'    => 'application/json'
            }

      expect(response).to have_http_status(:unauthorized)
    end

    it 'prevents cross-tenant access to another tenant session' do
      other_token = JsonWebToken.encode(user_id: 99, role: 'assessor', scheme: other_tenant.scheme)
      other_headers = {
        'Authorization' => "Bearer #{other_token}",
        'Content-Type'  => 'application/json'
      }

      patch "/api/v1/sessions/#{session_record.id}",
            params: { session: { candidate_name: 'Malicious Update' } }.to_json,
            headers: other_headers

      expect(response).to have_http_status(:not_found)
      expect(session_record.reload.candidate_name).to eq('Budi Santoso')
    end
  end

  describe 'POST /api/v1/assessments/:assessment_id/sessions' do
    it 'creates a new session with candidate_name and scopes it to current tenant' do
      post "/api/v1/assessments/#{assessment.id}/sessions",
           params: {
             session: {
               candidate_name: 'Ahmad Fauzi',
               candidate_id: 202
             }
           }.to_json,
           headers: auth_headers

      expect(response).to have_http_status(:created)
      json = JSON.parse(response.body)
      expect(json['session']['candidate_name']).to eq('Ahmad Fauzi')
      expect(json['session']['tenant_id']).to eq(tenant.id)
      expect(json['invite_url']).to be_present

      new_session = Session.find(json['session']['id'])
      expect(new_session.candidate_name).to eq('Ahmad Fauzi')
      expect(new_session.tenant_id).to eq(tenant.id)
    end
  end
end
