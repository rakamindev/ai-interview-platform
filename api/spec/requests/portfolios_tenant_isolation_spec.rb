# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Portfolio Tenant Isolation', type: :request do
  include FactoryHelpers

  let!(:org_a) { create_org!(name: 'Org A', scheme: 'org-a') }
  let!(:org_b) { create_org!(name: 'Org B', scheme: 'org-b') }

  let!(:assessment_a) { create(:assessment, tenant_id: org_a.id) }
  let!(:session_a)    { create(:session, assessment: assessment_a, tenant_id: org_a.id) }
  let!(:portfolio_a)  { create(:portfolio, session: session_a, tenant_id: org_a.id) }
  let!(:vacancy_a)    { create(:vacancy, tenant_id: org_a.id) }
  let!(:vacancy_b)    { create(:vacancy, tenant_id: org_b.id) }

  describe 'GET /api/v1/sessions/:id/portfolio' do
    it 'returns 404 when org_b user tries to access org_a portfolio' do
      get "/api/v1/sessions/#{session_a.id}/portfolio",
          headers: auth_headers_for(user_id: 99, role: 'admin', scheme: org_b.scheme)

      expect(response).to have_http_status(:not_found)
    end

    it 'returns 200 when org_a user accesses org_a portfolio' do
      get "/api/v1/sessions/#{session_a.id}/portfolio",
          headers: auth_headers_for(user_id: 1, role: 'admin', scheme: org_a.scheme)

      expect(response).to have_http_status(:ok)
    end
  end

  describe 'POST /api/v1/portfolios/:id/fitgap' do
    it 'returns 404 when org_b user tries to run fitgap on org_a portfolio' do
      post "/api/v1/portfolios/#{portfolio_a.id}/fitgap",
           params: { vacancy_id: vacancy_b.id }.to_json,
           headers: auth_headers_for(user_id: 99, role: 'admin', scheme: org_b.scheme)

      expect(response).to have_http_status(:not_found)
    end

    it 'returns 202 when org_a user runs fitgap on org_a portfolio' do
      post "/api/v1/portfolios/#{portfolio_a.id}/fitgap",
           params: { vacancy_id: vacancy_a.id }.to_json,
           headers: auth_headers_for(user_id: 1, role: 'admin', scheme: org_a.scheme)

      expect(response).to have_http_status(:accepted)
    end
  end

  describe 'GET /api/v1/portfolios/:id/fitgap/:vacancy_id' do
    it 'returns 404 when org_b user tries to view fitgap on org_a portfolio' do
      get "/api/v1/portfolios/#{portfolio_a.id}/fitgap/#{vacancy_b.id}",
          headers: auth_headers_for(user_id: 99, role: 'admin', scheme: org_b.scheme)

      expect(response).to have_http_status(:not_found)
    end
  end

  describe 'POST /api/v1/portfolios/:id/regenerate_fitgap' do
    it 'returns 404 when org_b user tries to regenerate fitgap on org_a portfolio' do
      post "/api/v1/portfolios/#{portfolio_a.id}/regenerate_fitgap",
           params: { vacancy_id: vacancy_b.id }.to_json,
           headers: auth_headers_for(user_id: 99, role: 'admin', scheme: org_b.scheme)

      expect(response).to have_http_status(:not_found)
    end
  end

  describe 'GET /api/v1/portfolios/:id/export' do
    it 'returns 404 when org_b user tries to export org_a portfolio' do
      get "/api/v1/portfolios/#{portfolio_a.id}/export",
          params: { format: 'json' },
          headers: auth_headers_for(user_id: 99, role: 'admin', scheme: org_b.scheme)

      expect(response).to have_http_status(:not_found)
    end

    it 'returns 200 when org_a user exports org_a portfolio' do
      get "/api/v1/portfolios/#{portfolio_a.id}/export",
          params: { format: 'json' },
          headers: auth_headers_for(user_id: 1, role: 'admin', scheme: org_a.scheme)

      expect(response).to have_http_status(:ok)
    end
  end
end
