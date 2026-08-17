# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Candidate wow endpoints', type: :request do
  let(:tenant) { create(:organization, name: 'Tenant', scheme: 'tenant-x', identifier: 'x') }
  let(:assessment) do
    create(:assessment, tenant_id: tenant.id, name: 'Product Manager')
  end

  let(:session) { create(:session, assessment:, tenant_id: tenant.id, candidate_name: 'Ada') }
  let(:portfolio) { create(:portfolio, session:) }

  before do
    create(:assessment_skill, assessment:, skill_label: 'Strategy')
    create(:assessment_skill, assessment:, skill_label: 'Execution')
    session.update!(invite_token: 'tok-123')
    portfolio
  end

  # ── feedback (W1) ──────────────────────────────────────────────────────────

  describe 'GET /api/v1/sessions/:token/feedback' do
    it 'is publicly reachable with just the invite token' do
      get '/api/v1/sessions/tok-123/feedback'

      expect(response.status).to eq(200)
      body = JSON.parse(response.body)
      expect(body.dig('feedback', 'role_title')).to eq('Product Manager')
      expect(body.dig('feedback', 'overall')).to include('Thank you')
    end

    it 'exposes strengths and growth areas without raw levels or overrides' do
      create(:portfolio_skill, portfolio:, skill_label: 'Strategy', ai_level: 4, ai_confidence: 'high', evidence: ['Q'])
      create(:portfolio_skill, portfolio:, skill_label: 'Execution', ai_level: 3, ai_confidence: 'low', evidence: [])

      get '/api/v1/sessions/tok-123/feedback'

      body = JSON.parse(response.body)['feedback']
      expect(body['strengths']).to eq(['Strategy'])
      expect(body['growth_areas']).to eq(['Execution'])
      expect(response.body).not_to include('override')
      expect(response.body).not_to include('ai_level')
    end

    it 'returns 404 when the token is invalid' do
      get '/api/v1/sessions/unknown-token/feedback'

      expect(response.status).to eq(404)
    end

    it 'returns 404 when the portfolio is not complete yet' do
      portfolio.update!(generation_status: 'pending')

      get '/api/v1/sessions/tok-123/feedback'

      expect(response.status).to eq(404)
      expect(response.body).to include('not ready')
    end
  end

  # ── integrity (W2) ─────────────────────────────────────────────────────────

  describe 'POST /api/v1/sessions/:token/integrity' do
    it 'records integrity metadata on the session' do
      post '/api/v1/sessions/tok-123/integrity',
           params: {
             integrity: {
               device_state: 'mic ok, camera passed',
               connection_health: 'stable',
               reconnect_events: 0
             }
           }

      expect(response.status).to eq(200)
      expect(session.reload.integrity_metadata).to include(
        'device_state' => 'mic ok, camera passed',
        'connection_health' => 'stable',
        'reconnect_events' => 0
      )
    end

    it 'merges partial updates instead of overwriting' do
      session.update!(integrity_metadata: { 'reconnect_events' => 1 })

      post '/api/v1/sessions/tok-123/integrity',
           params: { integrity: { 'connection_health' => 'flaky' } }

      expect(session.reload.integrity_metadata).to include(
        'reconnect_events' => 1,
        'connection_health' => 'flaky'
      )
    end

    it 'rejects unknown tokens' do
      post '/api/v1/sessions/nope/integrity', params: { integrity: {} }

      expect(response.status).to eq(404)
    end
  end

  # ── candidate_info (W5 skill areas) ────────────────────────────────────────

  describe 'GET /api/v1/sessions/:token/candidate' do
    it 'includes the assessment skill areas for the prep hub' do
      get '/api/v1/sessions/tok-123/candidate'

      expect(response.status).to eq(200)
      expect(JSON.parse(response.body)['skill_areas']).to eq(%w[Strategy Execution])
    end
  end

  # ── comparison (W4) ────────────────────────────────────────────────────────

  describe 'GET /api/v1/assessments/:id/comparison' do
    def auth_headers
      token = JsonWebToken.encode(user_id: 1, role: 'admin', scheme: tenant.scheme)
      { 'Authorization' => "Bearer #{token}" }
    end

    it 'ranks completed candidates for the assessment' do
      create(:portfolio_skill, portfolio:, skill_label: 'Strategy', ai_level: 4, ai_confidence: 'high', evidence: ['Q'])

      session2 = create(:session, assessment:, tenant_id: tenant.id, candidate_name: 'Bob')
      portfolio2 = create(:portfolio, session: session2)
      create(:portfolio_skill, portfolio: portfolio2, skill_label: 'Strategy', ai_level: 2, ai_confidence: 'low',
                               evidence: ['Q'])

      get "/api/v1/assessments/#{assessment.id}/comparison", headers: auth_headers

      expect(response.status).to eq(200)
      candidates = JSON.parse(response.body)['candidates']
      expect(candidates.map { |c| c['candidate_name'] }).to eq(%w[Ada Bob])
      expect(candidates.first['avg_level']).to eq(4.0)
      expect(candidates.first['coverage']['percent']).to eq(100)
    end

    it 'skips sessions without a complete portfolio' do
      pending_session = create(:session, assessment:, tenant_id: tenant.id, candidate_name: 'Pending')
      create(:portfolio, session: pending_session, generation_status: 'pending')

      get "/api/v1/assessments/#{assessment.id}/comparison", headers: auth_headers

      expect(response.status).to eq(200)
      expect(JSON.parse(response.body)['candidates'].size).to eq(1)
    end

    it 'denies a different tenant' do
      other = create(:organization, name: 'Other', scheme: 'other', identifier: 'o')
      create(:assessment, tenant_id: other.id, name: 'Other')
      token = JsonWebToken.encode(user_id: 1, role: 'admin', scheme: other.scheme)

      get "/api/v1/assessments/#{assessment.id}/comparison",
          headers: { 'Authorization' => "Bearer #{token}" }

      expect(response.status).to eq(404)
      expect(response.body).to include('Assessment not found')
    end
  end
end
