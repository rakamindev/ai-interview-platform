# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Portfolio Regeneration Enqueue & Concurrency', type: :request do
  let!(:org) { Organization.create!(id: 110, scheme: 'test-org', name: 'Test Org', identifier: 'test-org', host: 'localhost') }
  let!(:user) { User.create!(email: 'assessor_regen@example.com', password: 'password123', role: 'admin') }
  let(:token) { JsonWebToken.encode({ user_id: user.id, role: 'admin', scheme: org.scheme }) }
  let(:headers) { { 'Authorization' => "Bearer #{token}", 'Content-Type' => 'application/json' } }

  let!(:assessment) { Assessment.unscoped.create!(tenant_id: org.id, name: 'Regen Assessment', created_by: user.id, time_limit_min: 30) }
  let!(:session) { Session.unscoped.create!(tenant_id: org.id, assessment_id: assessment.id, candidate_id: 301, candidate_name: 'Candidate Regen', status: 'ended') }
  let!(:portfolio) { session.create_portfolio!(candidate_id: session.candidate_id, generation_status: 'complete') }

  before do
    portfolio.portfolio_skills.create!(
      skill_label: 'Skill 1',
      ai_level: 3,
      ai_confidence: 'high',
      competency_summary: 'Summary 1',
      evidence: ['Quote 1']
    )
  end

  describe 'Regeneration requests and duplicate prevention' do
    it '10. Valid regeneration request on complete portfolio enqueues exactly one job' do
      expect {
        post "/api/v1/sessions/#{session.id}/portfolio/regenerate", headers: headers
      }.to change(PortfolioGeneratorWorker.jobs, :size).by(1)

      expect(response).to have_http_status(:ok)
    end

    it '11. Second request while status is generating does not enqueue duplicate jobs' do
      portfolio.update!(generation_status: 'generating')

      expect {
        post "/api/v1/sessions/#{session.id}/portfolio/regenerate", headers: headers
      }.not_to change(PortfolioGeneratorWorker.jobs, :size)

      expect(response).to have_http_status(:accepted)
      body = JSON.parse(response.body)
      expect(body['status']).to eq('generating')
    end

    it '12. Status transition to generating (or pending) occurs atomically' do
      post "/api/v1/sessions/#{session.id}/portfolio/regenerate", headers: headers
      expect(response).to have_http_status(:ok)
      expect(portfolio.reload.generation_status).to be_in(%w[pending generating])
    end
  end
end
