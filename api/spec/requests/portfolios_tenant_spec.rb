require 'rails_helper'

RSpec.describe 'Portfolios Cross-Tenant Isolation', type: :request do
  let(:org_a) { Organization.create!(name: 'Corp A', scheme: 'corp-a', identifier: 'corp-a', host: 'corp-a.test') }
  let(:org_b) { Organization.create!(name: 'Corp B', scheme: 'corp-b', identifier: 'corp-b', host: 'corp-b.test') }

  let(:assessment_b) { Assessment.create!(tenant_id: org_b.id, created_by: 1, name: 'B Assessment', time_limit_min: 30) }
  let(:session_b) { Session.create!(tenant_id: org_b.id, assessment: assessment_b, status: 'ended') }
  let(:portfolio_b) { Portfolio.create!(session: session_b, generation_status: 'complete') }
  let(:skill_b) do
    PortfolioSkill.create!(
      portfolio: portfolio_b,
      skill_label: 'SQL',
      ai_level: 3,
      ai_confidence: 'high',
      evidence: ['Good query design'],
      competency_summary: 'Understands joins and indexing'
    )
  end

  let(:token_a) do
    #generate assessor bearer token punya tenant a
    JsonWebToken.encode({ user_id: 1, role: 'assessor', scheme: org_a.scheme })
  end

  describe 'GET /api/v1/portfolios/:id/export' do
    it 'blocks tenant a from exporting tenant b portfolio' do
      get "/api/v1/portfolios/#{portfolio_b.id}/export",
          headers: { 'Authorization' => "Bearer #{token_a}" }

      #pembatas if portfolio bukan milik tenant a, export must return 404
      expect(response).to have_http_status(:not_found)
    end
  end

  describe 'GET /api/v1/sessions/:id/portfolio' do
    it 'blocks tenant a from viewing tenant b session portfolio' do
      get "/api/v1/sessions/#{session_b.id}/portfolio",
          headers: { 'Authorization' => "Bearer #{token_a}" }

      #pembatas if session bukan milik tenant a, lookup must return 404
      expect(response).to have_http_status(:not_found)
    end
  end

  describe 'POST /api/v1/portfolio_skills/:id/override' do
    it 'blocks tenant a assessor from overriding tenant b skill ratings' do
      post "/api/v1/portfolio_skills/#{skill_b.id}/override",
           params: { override: { override_level: 4, assessor_notes: 'Unauthorized change' } },
           headers: { 'Authorization' => "Bearer #{token_a}" }

      #pembatas if skill bukan milik tenant a, override must return 404
      expect(response).to have_http_status(:not_found)
    end
  end
end
