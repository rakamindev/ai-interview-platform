# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::Admin::Candidates Biometrics Purge API', type: :request do
  let!(:organization) do
    Organization.create!(
      name: 'Rakamin Academy',
      scheme: 'rakamin',
      identifier: 'rakamin-main',
      host: 'rakamin.com',
      config: {}
    )
  end

  let!(:assessment) do
    Assessment.create!(
      tenant_id: organization.id,
      created_by: 1,
      name: 'Frontend Architect Assessment',
      time_limit_min: 45
    )
  end

  let(:candidate_id) { 888 }
  let!(:candidate_session_1) do
    s = Session.create!(
      tenant_id: organization.id,
      assessment_id: assessment.id,
      candidate_id: candidate_id,
      candidate_name: 'Charlie Candidate',
      status: 'ended',
      end_reason: 'manual_candidate',
      consented_at: 2.days.ago,
      consent_ip_address: '10.0.0.1',
      created_at: 2.days.ago
    )
    s.transcript_turns.create!(turn_number: 1, speaker: 'candidate', text: 'Sensitive personal biometrics')
    s
  end

  let!(:candidate_session_2) do
    s = Session.create!(
      tenant_id: organization.id,
      assessment_id: assessment.id,
      candidate_id: candidate_id,
      candidate_name: 'Charlie Candidate',
      status: 'active',
      consented_at: 1.day.ago,
      consent_ip_address: '10.0.0.2',
      created_at: 1.day.ago
    )
    s.transcript_turns.create!(turn_number: 1, speaker: 'candidate', text: 'Another sensitive voice transcript turn')
    s
  end

  let(:admin_headers) { auth_headers(user_id: 1, role: 'admin', scheme: 'rakamin') }
  let(:non_admin_headers) { auth_headers(user_id: 2, role: 'user', scheme: 'rakamin') }

  describe 'DELETE /api/v1/admin/candidates/:id/biometrics' do
    context 'when request is unauthenticated' do
      it 'blocks access with 401 Unauthorized' do
        delete "/api/v1/admin/candidates/#{candidate_id}/biometrics",
               headers: { 'X-Tenant-Scheme' => 'rakamin' }

        expect(response).to have_http_status(:unauthorized)
      end
    end

    context 'when request has non-admin role' do
      it 'blocks access with 403 Forbidden' do
        delete "/api/v1/admin/candidates/#{candidate_id}/biometrics",
               headers: non_admin_headers

        expect(response).to have_http_status(:forbidden)
      end
    end

    context 'when authenticated as admin' do
      it 'atomically purges all biometric transcripts and PII across candidate sessions' do
        expect(candidate_session_1.transcript_turns.count).to eq(1)
        expect(candidate_session_2.transcript_turns.count).to eq(1)

        delete "/api/v1/admin/candidates/#{candidate_id}/biometrics",
               headers: admin_headers

        expect(response).to have_http_status(:ok)
        expect(json[:success]).to be true
        expect(json[:purged_sessions_count]).to eq(2)
        expect(json[:message]).to match(/permanently purged/i)

        candidate_session_1.reload
        candidate_session_2.reload

        expect(candidate_session_1.transcript_turns.count).to eq(0)
        expect(candidate_session_2.transcript_turns.count).to eq(0)

        expect(candidate_session_1.candidate_name).to eq('Anonymized Candidate')
        expect(candidate_session_2.candidate_name).to eq('Anonymized Candidate')

        expect(candidate_session_1.anonymized_at).to be_present
        expect(candidate_session_2.anonymized_at).to be_present
      end

      it 'returns 404 when candidate has no sessions' do
        delete '/api/v1/admin/candidates/999999/biometrics',
               headers: admin_headers

        expect(response).to have_http_status(:not_found)
      end
    end
  end
end
