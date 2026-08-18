# frozen_string_literal: true

require 'rails_helper'

# Proves cross-tenant isolation for the portfolio subtree.
#
# An assessor of tenant A must get a 404 (not found — never an existence
# oracle) when touching tenant B's portfolios, portfolio skills, fit/gap
# reports or overrides, while tenant A's own resources keep working.
RSpec.describe 'Cross-tenant portfolio isolation', type: :request do
  let(:tenant_a) do
    create(:organization, name: 'Tenant A', scheme: 'tenant-a', identifier: 'tenant-a', host: 'a.example.com')
  end
  let(:tenant_b) do
    create(:organization, name: 'Tenant B', scheme: 'tenant-b', identifier: 'tenant-b', host: 'b.example.com')
  end

  let(:auth_a) do
    token = JsonWebToken.encode({ user_id: 1, role: 'admin', scheme: 'tenant-a' })
    { 'Authorization' => "Bearer #{token}" }
  end

  # Tenant B's complete data chain (fresh per example thanks to transactional
  # fixtures — a leaked write in a pre-fix run cannot poison other examples).
  let!(:assessment_b) { create(:assessment, tenant_id: tenant_b.id, created_by: 1) }
  let!(:session_b)    { create(:session, tenant_id: tenant_b.id, assessment: assessment_b) }
  let!(:portfolio_b)  { create(:portfolio, session: session_b, generation_status: 'complete') }
  let!(:skill_b)      { create(:portfolio_skill, portfolio: portfolio_b) }
  let!(:vacancy_b)    { create(:vacancy, tenant_id: tenant_b.id, created_by: 1) }
  let!(:report_b)     { create(:fit_gap_report, portfolio: portfolio_b, vacancy: vacancy_b) }

  # Tenant A's own chain for the positive controls.
  let!(:assessment_a) { create(:assessment, tenant_id: tenant_a.id, created_by: 1) }
  let!(:session_a)    { create(:session, tenant_id: tenant_a.id, assessment: assessment_a) }
  let!(:portfolio_a)  { create(:portfolio, session: session_a, generation_status: 'complete') }
  let!(:skill_a)      { create(:portfolio_skill, portfolio: portfolio_a) }
  let!(:vacancy_a)    { create(:vacancy, tenant_id: tenant_a.id, created_by: 1) }
  let!(:report_a)     { create(:fit_gap_report, portfolio: portfolio_a, vacancy: vacancy_a) }

  describe 'tenant A cannot read or write tenant B resources' do
    it 'GET /portfolios/:id/export is denied' do
      get "/api/v1/portfolios/#{portfolio_b.id}/export", headers: auth_a

      expect(response).to have_http_status(:not_found)
    end

    it 'GET /portfolios/:id/fitgap/:vacancy_id is denied' do
      get "/api/v1/portfolios/#{portfolio_b.id}/fitgap/#{vacancy_b.id}", headers: auth_a

      expect(response).to have_http_status(:not_found)
    end

    it 'POST /portfolios/:id/fitgap is denied' do
      post "/api/v1/portfolios/#{portfolio_b.id}/fitgap",
           params: { fitgap: { vacancy_id: vacancy_b.id } },
           headers: auth_a

      expect(response).to have_http_status(:not_found)
    end

    it 'POST /portfolios/:id/regenerate_fitgap is denied' do
      post "/api/v1/portfolios/#{portfolio_b.id}/regenerate_fitgap",
           params: { vacancy_id: vacancy_b.id },
           headers: auth_a

      expect(response).to have_http_status(:not_found)
    end

    it 'POST /portfolio_skills/:id/override is denied' do
      post "/api/v1/portfolio_skills/#{skill_b.id}/override",
           params: { override: { override_level: 3 } },
           headers: auth_a

      expect(response).to have_http_status(:not_found)
    end
  end

  describe 'tenant A can still use its own resources' do
    it 'GET /portfolios/:id/export returns its own portfolio' do
      get "/api/v1/portfolios/#{portfolio_a.id}/export", headers: auth_a

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body['portfolio']['id']).to eq(portfolio_a.id)
    end

    it 'GET /portfolios/:id/fitgap/:vacancy_id returns its own report' do
      get "/api/v1/portfolios/#{portfolio_a.id}/fitgap/#{vacancy_a.id}", headers: auth_a

      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body).dig('report', 'id')).to eq(report_a.id)
    end

    it 'POST /portfolios/:id/fitgap returns the cached report' do
      post "/api/v1/portfolios/#{portfolio_a.id}/fitgap",
           params: { fitgap: { vacancy_id: vacancy_a.id } },
           headers: auth_a

      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body).dig('report', 'id')).to eq(report_a.id)
    end

    it 'POST /portfolio_skills/:id/override creates the override' do
      post "/api/v1/portfolio_skills/#{skill_a.id}/override",
           params: { override: { override_level: 3, assessor_notes: 'Solid candidate' } },
           headers: auth_a

      expect(response).to have_http_status(:created)
      expect(skill_a.reload.assessor_override.override_level).to eq(3)
    end
  end
end
