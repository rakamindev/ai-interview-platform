# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::Portfolios', type: :request do
  let!(:org1) { Organization.find_or_create_by!(id: 1, name: 'Org One', scheme: 'org-one', identifier: 'org-one', host: 'localhost') }
  let!(:org2) { Organization.find_or_create_by!(id: 2, name: 'Org Two', scheme: 'org-two', identifier: 'org-two', host: 'org2.local') }

  let(:token1) { JsonWebToken.encode({ user_id: 10, role: 'admin', scheme: 'org-one' }) }
  let(:token2) { JsonWebToken.encode({ user_id: 20, role: 'admin', scheme: 'org-two' }) }

  let(:session1) do
    Current.organization = org1
    Current.tenant_id = org1.id
    assessment = Assessment.create!(name: 'Staff Engineer', time_limit_min: 45, created_by: 10)
    Session.create!(assessment: assessment, tenant_id: org1.id, candidate_name: 'Budi Santoso')
  end

  let!(:portfolio1) do
    Current.organization = org1
    Current.tenant_id = org1.id
    p = Portfolio.create!(session: session1, generation_status: 'complete')
    p.portfolio_skills.create!(
      skill_label: 'Architecture',
      is_assessed: true,
      ai_level: 4,
      ai_confidence: 'high',
      competency_summary: 'Superb architecture thinking'
    )
    p
  end

  describe 'GET /api/v1/sessions/:id/portfolio' do
    it 'returns portfolio for the owning tenant' do
      get "/api/v1/sessions/#{session1.id}/portfolio", headers: { 'Authorization' => "Bearer #{token1}" }
      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json['portfolio']['id']).to eq(portfolio1.id)
      expect(json['portfolio']['candidate_name']).to eq('Budi Santoso')
    end

    it 'blocks cross-tenant access from another organization' do
      get "/api/v1/sessions/#{session1.id}/portfolio", headers: { 'Authorization' => "Bearer #{token2}" }
      expect(response).to have_http_status(:not_found)
    end
  end

  describe 'GET /api/v1/portfolios/:id/export' do
    it 'exports PDF for the owning tenant' do
      get "/api/v1/portfolios/#{portfolio1.id}/export?format=pdf", headers: { 'Authorization' => "Bearer #{token1}" }
      expect(response).to have_http_status(:ok)
      expect(response.headers['Content-Type']).to eq('application/pdf')
    end

    it 'blocks cross-tenant export from another organization' do
      get "/api/v1/portfolios/#{portfolio1.id}/export?format=pdf", headers: { 'Authorization' => "Bearer #{token2}" }
      expect(response).to have_http_status(:not_found)
    end
  end
end
