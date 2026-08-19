# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Candidate Session Progress API', type: :request do
  let(:org) do
    Organization.create!(
      name: 'Rakamin Tech',
      scheme: 'rakamin-tech-spec',
      identifier: 'rakamin-tech-spec',
      host: 'spec.rakamin.com'
    )
  end
  let(:user) { User.create!(email: 'recruiter@rakamin.com', password: 'password', role: 'assessor') }
  let(:assessment) { Assessment.create!(name: 'QA Engineer', language: 'id', time_limit_min: 30, tenant_id: org.id, created_by: user.id) }
  let(:session_obj) do
    Session.create!(
      tenant_id: org.id,
      assessment: assessment,
      candidate_name: 'Budi Santoso',
      invite_token: 'valid-test-token-12345',
      status: 'pending',
      candidate_stage: 'welcome'
    )
  end

  describe 'PATCH /api/v1/sessions/:token/progress' do
    it 'updates candidate stage and records consent timestamp' do
      patch "/api/v1/sessions/#{session_obj.invite_token}/progress", params: {
        stage: 'device_check',
        consent_accepted: true
      }

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json['candidate_stage']).to eq('device_check')
      expect(json['consent_accepted_at']).not_to be_nil

      session_obj.reload
      expect(session_obj.candidate_stage).to eq('device_check')
      expect(session_obj.consent_accepted_at).not_to be_nil
    end

    it 'records device check passed timestamp and increments resume count when transitioning to live' do
      patch "/api/v1/sessions/#{session_obj.invite_token}/progress", params: {
        stage: 'live',
        device_check_passed: true
      }

      expect(response).to have_http_status(:ok)
      session_obj.reload
      expect(session_obj.candidate_stage).to eq('live')
      expect(session_obj.device_check_passed_at).not_to be_nil
      expect(session_obj.resume_count).to eq(1)
    end

    it 'returns 404 for non-existent token' do
      patch '/api/v1/sessions/invalid-token-999/progress', params: { stage: 'device_check' }
      expect(response).to have_http_status(:not_found)
    end
  end
end
