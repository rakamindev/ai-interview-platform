# frozen_string_literal: true

require 'rails_helper'

# Regression coverage for the cross-tenant IDOR on Portfolio/FitGapReport:
# any authenticated assessor/admin JWT — valid for any tenant — could
# previously look these up by raw sequential id and read another
# organization's candidate data. Portfolio and FitGapReport now include
# TenantScoped, same as Session/Assessment/Vacancy.
RSpec.describe 'Portfolio tenant isolation', type: :request do
  let!(:org_a) { create(:organization) }
  let!(:org_b) { create(:organization) }

  let!(:portfolio_a) do
    assessment = create(:assessment, organization: org_a)
    session    = create(:session, assessment: assessment, tenant_id: org_a.id)
    create(:portfolio, session: session)
  end

  let!(:portfolio_b) do
    assessment = create(:assessment, organization: org_b)
    session    = create(:session, assessment: assessment, tenant_id: org_b.id)
    create(:portfolio, session: session)
  end

  def auth_headers(scheme)
    token = JsonWebToken.encode(user_id: 1, role: 'admin', scheme:)
    { 'Authorization' => "Bearer #{token}" }
  end

  describe 'GET /api/v1/portfolios/:id/export' do
    it "serves the portfolio to the tenant that owns it" do
      get "/api/v1/portfolios/#{portfolio_a.id}/export", headers: auth_headers(org_a.scheme)

      expect(response).to have_http_status(:ok)
    end

    it "returns 404 for another tenant's portfolio instead of leaking it" do
      get "/api/v1/portfolios/#{portfolio_b.id}/export", headers: auth_headers(org_a.scheme)

      expect(response).to have_http_status(:not_found)
      expect(JSON.parse(response.body).dig('errors', 0, 'message')).to eq('Portfolio not found')
    end
  end

  describe 'GET /api/v1/portfolios/:id/fitgap/:vacancy_id' do
    let!(:vacancy_a) { create(:vacancy, organization: org_a) }
    let!(:report_a)  { create(:fit_gap_report, portfolio: portfolio_a, vacancy: vacancy_a) }

    it 'is reachable within the owning tenant' do
      get "/api/v1/portfolios/#{portfolio_a.id}/fitgap/#{vacancy_a.id}", headers: auth_headers(org_a.scheme)

      expect(response).to have_http_status(:ok)
    end

    it "returns 404 for another tenant's portfolio id instead of the report" do
      get "/api/v1/portfolios/#{portfolio_b.id}/fitgap/#{vacancy_a.id}", headers: auth_headers(org_a.scheme)

      expect(response).to have_http_status(:not_found)
      expect(JSON.parse(response.body).dig('errors', 0, 'message')).to eq('Portfolio not found')
    end
  end

  describe 'POST /api/v1/portfolios/:id/regenerate_fitgap' do
    let!(:vacancy_a) { create(:vacancy, organization: org_a) }

    it "returns 404 for another tenant's portfolio instead of queuing a job against it" do
      post "/api/v1/portfolios/#{portfolio_b.id}/regenerate_fitgap",
           params:  { vacancy_id: vacancy_a.id },
           headers: auth_headers(org_a.scheme)

      expect(response).to have_http_status(:not_found)
      expect(JSON.parse(response.body).dig('errors', 0, 'message')).to eq('Portfolio not found')
    end
  end

  describe 'PortfolioSkill override, scoped through portfolio' do
    let!(:skill_b) { create(:portfolio_skill, portfolio: portfolio_b) }

    it "returns 404 when overriding another tenant's portfolio skill" do
      post "/api/v1/portfolio_skills/#{skill_b.id}/override",
           params:  { override: { override_level: 4, assessor_notes: 'nope' } },
           headers: auth_headers(org_a.scheme)

      expect(response).to have_http_status(:not_found)
    end
  end
end
