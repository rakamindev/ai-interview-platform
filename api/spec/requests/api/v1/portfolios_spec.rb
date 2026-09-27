# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Portfolios & Overrides Tenant Scoping', type: :request do
  let!(:org_a) { create(:organization, scheme: 'org-a') }
  let!(:org_b) { create(:organization, scheme: 'org-b') }

  let!(:assessor_a) { create(:user, :assessor, organization: org_a) }
  let!(:assessor_b) { create(:user, :assessor, organization: org_b) }

  let!(:assessment_a) { create(:assessment, tenant_id: org_a.id, created_by: assessor_a.id) }
  let!(:session_a)    { create(:session, tenant_id: org_a.id, assessment: assessment_a) }
  let!(:portfolio_a)  { create(:portfolio, session: session_a, generation_status: 'complete') }
  let!(:skill_a)      { create(:portfolio_skill, portfolio: portfolio_a) }
  let!(:vacancy_a)    { create(:vacancy, tenant_id: org_a.id, created_by: assessor_a.id) }

  let!(:assessment_b) { create(:assessment, tenant_id: org_b.id, created_by: assessor_b.id) }
  let!(:session_b)    { create(:session, tenant_id: org_b.id, assessment: assessment_b) }
  let!(:portfolio_b)  { create(:portfolio, session: session_b, generation_status: 'complete') }
  let!(:skill_b)      { create(:portfolio_skill, portfolio: portfolio_b) }
  let!(:vacancy_b)    { create(:vacancy, tenant_id: org_b.id, created_by: assessor_b.id) }

  let(:headers_a) { authenticated_headers(assessor_a, scheme: org_a.scheme) }
  let(:headers_b) { authenticated_headers(assessor_b, scheme: org_b.scheme) }

  before do
    allow(FitGapGeneratorWorker).to receive(:perform_async)
    allow(PortfolioGeneratorWorker).to receive(:perform_async)
  end

  describe 'GET /api/v1/portfolios/:id' do
    it 'allows tenant A to access their own portfolio' do
      get "/api/v1/portfolios/#{portfolio_a.id}", headers: headers_a

      expect(response).to have_http_status(:ok)
      expect(json_body.dig(:portfolio, :id)).to eq(portfolio_a.id)
    end

    it 'returns 404 Not Found when tenant A attempts to access tenant B portfolio' do
      get "/api/v1/portfolios/#{portfolio_b.id}", headers: headers_a

      expect(response).to have_http_status(:not_found)
      expect(json_body[:errors].first[:message]).to eq('Portfolio not found')
    end
  end

  describe 'GET /api/v1/sessions/:id/portfolio' do
    it 'allows tenant A to access portfolio of their own session' do
      get "/api/v1/sessions/#{session_a.id}/portfolio", headers: headers_a

      expect(response).to have_http_status(:ok)
      expect(json_body.dig(:portfolio, :id)).to eq(portfolio_a.id)
    end

    it 'returns 404 Not Found when tenant A attempts to access portfolio of tenant B session' do
      get "/api/v1/sessions/#{session_b.id}/portfolio", headers: headers_a

      expect(response).to have_http_status(:not_found)
      expect(json_body[:errors].first[:message]).to eq('Session not found')
    end
  end

  describe 'GET /api/v1/portfolios/:id/export' do
    it 'allows tenant A to export their own portfolio' do
      get "/api/v1/portfolios/#{portfolio_a.id}/export",
          params: { format: 'json' },
          headers: headers_a

      expect(response).to have_http_status(:ok)
      expect(json_body.dig(:portfolio, :id)).to eq(portfolio_a.id)
    end

    it 'returns 404 Not Found when tenant A attempts to export tenant B portfolio' do
      get "/api/v1/portfolios/#{portfolio_b.id}/export",
          params: { format: 'json' },
          headers: headers_a

      expect(response).to have_http_status(:not_found)
      expect(json_body[:errors].first[:message]).to eq('Portfolio not found')
    end
  end

  describe 'POST /api/v1/portfolios/:id/fitgap' do
    it 'allows tenant A to generate fitgap for their own portfolio' do
      post "/api/v1/portfolios/#{portfolio_a.id}/fitgap",
           params: { vacancy_id: vacancy_a.id }.to_json,
           headers: headers_a

      expect(response).to have_http_status(:accepted)
      expect(json_body[:status]).to eq('generating')
    end

    it 'returns 404 Not Found when tenant A attempts fitgap on tenant B portfolio' do
      post "/api/v1/portfolios/#{portfolio_b.id}/fitgap",
           params: { vacancy_id: vacancy_a.id }.to_json,
           headers: headers_a

      expect(response).to have_http_status(:not_found)
      expect(json_body[:errors].first[:message]).to eq('Portfolio not found')
    end
  end

  describe 'POST /api/v1/portfolios/:id/regenerate_fitgap' do
    it 'allows tenant A to regenerate fitgap for their own portfolio' do
      post "/api/v1/portfolios/#{portfolio_a.id}/regenerate_fitgap",
           params: { vacancy_id: vacancy_a.id }.to_json,
           headers: headers_a

      expect(response).to have_http_status(:accepted)
      expect(json_body[:status]).to eq('generating')
    end

    it 'returns 404 Not Found when tenant A attempts regenerate_fitgap on tenant B portfolio' do
      post "/api/v1/portfolios/#{portfolio_b.id}/regenerate_fitgap",
           params: { vacancy_id: vacancy_a.id }.to_json,
           headers: headers_a

      expect(response).to have_http_status(:not_found)
      expect(json_body[:errors].first[:message]).to eq('Portfolio not found')
    end
  end

  describe 'GET /api/v1/portfolios/:id/fitgap/:vacancy_id' do
    let!(:report_a) do
      create(:fit_gap_report, portfolio: portfolio_a, vacancy: vacancy_a)
    end
    let!(:report_b) do
      create(:fit_gap_report, portfolio: portfolio_b, vacancy: vacancy_b)
    end

    it 'allows tenant A to view fitgap report for their own portfolio' do
      get "/api/v1/portfolios/#{portfolio_a.id}/fitgap/#{vacancy_a.id}", headers: headers_a

      expect(response).to have_http_status(:ok)
      expect(json_body.dig(:report, :portfolio_id)).to eq(portfolio_a.id)
    end

    it 'returns 404 Not Found when tenant A attempts to view tenant B fitgap report' do
      get "/api/v1/portfolios/#{portfolio_b.id}/fitgap/#{vacancy_b.id}", headers: headers_a

      expect(response).to have_http_status(:not_found)
      expect(json_body[:errors].first[:message]).to eq('Portfolio not found')
    end
  end

  describe 'POST /api/v1/portfolio_skills/:id/override' do
    it 'allows tenant A to override a skill in their own portfolio' do
      post "/api/v1/portfolio_skills/#{skill_a.id}/override",
           params: { override: { override_level: 4, assessor_notes: 'Stronger performance' } }.to_json,
           headers: headers_a

      expect(response).to have_http_status(:created)
      expect(json_body.dig(:override, :override_level)).to eq(4)
      expect(json_body.dig(:override, :overridden_by)).to eq(assessor_a.id)
    end

    it 'returns 404 Not Found when tenant A attempts to override tenant B portfolio skill' do
      post "/api/v1/portfolio_skills/#{skill_b.id}/override",
           params: { override: { override_level: 4, assessor_notes: 'Illegal override' } }.to_json,
           headers: headers_a

      expect(response).to have_http_status(:not_found)
      expect(json_body[:errors].first[:message]).to eq('Portfolio skill not found')
    end
  end
end
