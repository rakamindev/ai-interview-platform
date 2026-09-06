# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Dashboard API', type: :request do
  let(:organization) { create(:organization, scheme: 'test-corp') }
  let!(:user) { create(:user, email: 'assessor@test.com') }
  let(:token) { login_get_token(email: 'assessor@test.com', password: 'password123') }
  let(:headers) { tenant_headers.merge(auth_headers(token)) }

  before { with_current_tenant(organization) }

  describe 'GET /api/v1/dashboard/stats' do
    it 'aggregates session counts with corrected completed/failed semantics' do
      assessment = create(:assessment, created_by: user.id)
      create(:session, assessment:)
      create(:session, assessment:, status: 'active')
      create(:session, assessment:, status: 'ended', end_reason: 'all_covered')
      create(:session, assessment:, status: 'ended', end_reason: 'error')

      get '/api/v1/dashboard/stats', headers: headers

      expect(response).to have_http_status(:ok)
      totals = json_body['totals']
      expect(totals).to include('pending' => 1, 'active' => 1, 'ended' => 1, 'failed' => 1)
      expect(json_body['total']).to eq(4)
      expect(json_body['started']).to eq(3)
      expect(json_body['completion_rate']).to eq(33.3)
    end

    it 'excludes sessions from other tenants' do
      other_org = create(:organization, scheme: 'other-corp')
      my_assessment = create(:assessment, created_by: user.id)
      create(:session, assessment: my_assessment, status: 'active')

      with_current_tenant(other_org)
      other_assessment = create(:assessment, created_by: user.id)
      create(:session, assessment: other_assessment, status: 'active')
      with_current_tenant(organization)

      get '/api/v1/dashboard/stats', headers: headers

      expect(response).to have_http_status(:ok)
      expect(json_body['totals']['active']).to eq(1)
      expect(json_body['per_assessment'].size).to eq(1)
    end

    it 'lists live (active) sessions with assessment name' do
      assessment = create(:assessment, name: 'Backend Engineer', created_by: user.id)
      live = create(:session, assessment:, status: 'active', candidate_name: 'Budi')

      get '/api/v1/dashboard/stats', headers: headers

      expect(response).to have_http_status(:ok)
      live_sessions = json_body['live_sessions']
      expect(live_sessions.size).to eq(1)
      expect(live_sessions.first).to include(
        'id' => live.id,
        'assessment_name' => 'Backend Engineer',
        'candidate_name' => 'Budi'
      )
    end

    it 'returns per-assessment summaries with derived metrics' do
      assessment = create(:assessment, created_by: user.id)
      create(:session, assessment:, status: 'pending')
      create(:session, assessment:, status: 'active')
      create(:session, assessment:, status: 'ended', end_reason: 'time_ceiling', duration_seconds: 600)
      create(:session, assessment:, status: 'ended', end_reason: 'error')

      get '/api/v1/dashboard/stats', headers: headers

      expect(response).to have_http_status(:ok)
      row = json_body['per_assessment'].first
      expect(row).to include(
        'id' => assessment.id,
        'total' => 4,
        'started' => 3,
        'completion_rate' => 33.3,
        'avg_duration_seconds' => 600.0
      )
      expect(row['totals']).to include('pending' => 1, 'active' => 1, 'ended' => 1, 'failed' => 1)
      expect(row['ended_reasons']).to include({ 'reason' => 'time_ceiling', 'count' => 1 },
                                              { 'reason' => 'error', 'count' => 1 })
    end

    it 'breaks global ended sessions down by end_reason' do
      assessment = create(:assessment, created_by: user.id)
      create(:session, assessment:, status: 'ended', end_reason: 'all_covered')
      create(:session, assessment:, status: 'ended', end_reason: 'manual_candidate')

      get '/api/v1/dashboard/stats', headers: headers

      expect(response).to have_http_status(:ok)
      reasons = json_body['ended_reasons']
      expect(reasons).to include({ 'reason' => 'all_covered', 'count' => 1 },
                                 { 'reason' => 'manual_candidate', 'count' => 1 })
    end

    it 'requires an authenticated assessor' do
      get '/api/v1/dashboard/stats', headers: tenant_headers

      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe 'GET /api/v1/assessments/:assessment_id/dashboard' do
    it 'returns counts for the given assessment only' do
      assessment = create(:assessment, created_by: user.id)
      other      = create(:assessment, created_by: user.id)
      create(:session, assessment:, status: 'active')
      create(:session, assessment:, status: 'pending')
      create(:session, assessment: other, status: 'active')

      get "/api/v1/assessments/#{assessment.id}/dashboard", headers: headers

      expect(response).to have_http_status(:ok)
      expect(json_body['assessment_id']).to eq(assessment.id)
      expect(json_body['totals']).to include('active' => 1, 'pending' => 1)
      expect(json_body['started']).to eq(1)
    end

    it 'breaks ended sessions down by end_reason' do
      assessment = create(:assessment, created_by: user.id)
      create(:session, assessment:, status: 'ended', end_reason: 'all_covered')
      create(:session, assessment:, status: 'ended', end_reason: 'manual_candidate')

      get "/api/v1/assessments/#{assessment.id}/dashboard", headers: headers

      expect(response).to have_http_status(:ok)
      reasons = json_body['ended_reasons']
      expect(reasons).to include({ 'reason' => 'all_covered', 'count' => 1 },
                                 { 'reason' => 'manual_candidate', 'count' => 1 })
    end

    it 'counts error-ended sessions as failed' do
      assessment = create(:assessment, created_by: user.id)
      create(:session, assessment:, status: 'ended', end_reason: 'error')
      create(:session, assessment:, status: 'ended', end_reason: 'all_covered', duration_seconds: 300)

      get "/api/v1/assessments/#{assessment.id}/dashboard", headers: headers

      expect(response).to have_http_status(:ok)
      expect(json_body['totals']).to include('ended' => 1, 'failed' => 1)
      expect(json_body['completion_rate']).to eq(50.0)
      expect(json_body['avg_duration_seconds']).to eq(300.0)
    end

    it 'returns 404 for a nonexistent assessment' do
      get '/api/v1/assessments/999999/dashboard', headers: headers

      expect(response).to have_http_status(:not_found)
    end
  end
end
