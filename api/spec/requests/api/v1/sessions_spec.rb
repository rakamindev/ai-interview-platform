# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Sessions API', type: :request do
  let(:tenant_scheme) { 'test-corp' }
  let(:assessor_token) do
    JsonWebToken.encode({ user_id: 1, role: 'assessor', scheme: tenant_scheme })
  end
  let(:auth_headers) do
    {
      'Authorization' => "Bearer #{assessor_token}",
      'X-Tenant-Scheme' => tenant_scheme,
      'Content-Type' => 'application/json'
    }
  end

  let!(:assessment) do
    Assessment.create!(
      name: 'General Assessment',
      tenant_id: 'tenant-123',
      time_limit_min: 45
    )
  end

  describe 'POST /api/v1/sessions/:token/consent (SPEC-P0-01)' do
    it 'records candidate consent with IP and terms_version without requiring JWT' do
      session = Session.create!(
        assessment_id: assessment.id,
        tenant_id: 'tenant-123',
        status: 'pending'
      )

      post "/api/v1/sessions/#{session.invite_token}/consent",
           params: { terms_version: '2026.1' }.to_json,
           headers: { 'Content-Type' => 'application/json', 'REMOTE_ADDR' => '103.28.12.1' }

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json['consented']).to be true
      expect(json['terms_version']).to eq('2026.1')

      session.reload
      expect(session.consented_at).to be_present
      expect(session.consent_ip).to eq('103.28.12.1')
    end

    it 'returns 422 if session is already ended' do
      session = Session.create!(
        assessment_id: assessment.id,
        tenant_id: 'tenant-123',
        status: 'ended',
        end_reason: 'manual_candidate'
      )

      post "/api/v1/sessions/#{session.invite_token}/consent",
           params: { terms_version: '2026.1' }.to_json,
           headers: { 'Content-Type' => 'application/json' }

      expect(response).to have_http_status(:unprocessable_entity)
      json = JSON.parse(response.body)
      expect(json['error']).to eq('Session is already ended')
    end
  end

  describe 'POST /api/v1/sessions/:id/reopen (SPEC-P2-01)' do
    it 'reopens an error session back to pending and preserves turns' do
      session = Session.create!(
        assessment_id: assessment.id,
        tenant_id: 'tenant-123',
        status: 'ended',
        end_reason: 'error',
        started_at: 10.minutes.ago,
        ended_at: 2.minutes.ago,
        duration_seconds: 480
      )

      post "/api/v1/sessions/#{session.id}/reopen", headers: auth_headers

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json['session']['status']).to eq('pending')
      expect(json['session']['end_reason']).to be_nil

      session.reload
      expect(session.status).to eq('pending')
      expect(session.end_reason).to be_nil
      expect(session.ended_at).to be_nil
      expect(session.duration_seconds).to be_nil
    end

    it 'rejects reopening sessions that ended normally unless force=true' do
      session = Session.create!(
        assessment_id: assessment.id,
        tenant_id: 'tenant-123',
        status: 'ended',
        end_reason: 'all_covered'
      )

      post "/api/v1/sessions/#{session.id}/reopen", headers: auth_headers

      expect(response).to have_http_status(:unprocessable_entity)
      json = JSON.parse(response.body)
      expect(json['error']).to include('Only sessions ended due to connection or system errors can be reopened')
    end
  end

  describe 'POST /api/v1/assessments/:assessment_id/sessions/batch (SPEC-P2-02)' do
    it 'creates sessions in bulk with candidate names and emails' do
      assessment = Assessment.create!(
        name: 'Staff SRE Assessment',
        tenant_id: 'tenant-123',
        time_limit_min: 45
      )

      candidates = [
        { name: 'Alice Tan', email: 'alice.tan@example.com' },
        { name: 'Budi Santoso', email: 'budi.santoso@example.com' }
      ]

      post "/api/v1/assessments/#{assessment.id}/sessions/batch",
           params: { candidates: candidates }.to_json,
           headers: auth_headers

      expect(response).to have_http_status(:created)
      json = JSON.parse(response.body)
      expect(json['count']).to eq(2)
      expect(json['sessions'].length).to eq(2)

      emails = json['sessions'].map { |s| s['candidate_email'] }
      expect(emails).to contain_exactly('alice.tan@example.com', 'budi.santoso@example.com')
    end

    it 'enforces maximum limit of 500 candidates' do
      assessment = Assessment.create!(
        name: 'Batch Limit Test Assessment',
        tenant_id: 'tenant-123',
        time_limit_min: 30
      )

      oversized_candidates = Array.new(501) { |i| { name: "Candidate #{i}", email: "cand#{i}@example.com" } }

      post "/api/v1/assessments/#{assessment.id}/sessions/batch",
           params: { candidates: oversized_candidates }.to_json,
           headers: auth_headers

      expect(response).to have_http_status(:unprocessable_entity)
      json = JSON.parse(response.body)
      expect(json['error']).to eq('Batch size cannot exceed 500 candidates per upload')
    end
  end
end
