# frozen_string_literal: true

require 'rails_helper'

# SEC-3: portfolio-family records must be reachable only within the caller's
# tenant. They are scoped through their (tenant-scoped) session.
RSpec.describe 'Api::V1::Portfolios (tenant isolation)', type: :request do
  let(:org) { create(:organization, scheme: 'test-corp') }
  let(:headers) { auth_headers(scheme: org.scheme) }

  def portfolio_in(tenant_id)
    session = create(:session, tenant_id: tenant_id)
    create(:portfolio, session: session, generation_status: 'complete')
  end

  describe 'GET /api/v1/portfolios/:id/export' do
    it 'exports a portfolio in the caller tenant' do
      portfolio = portfolio_in(org.id)

      get "/api/v1/portfolios/#{portfolio.id}/export", params: { format: 'json' }, headers: headers

      expect(response).to have_http_status(:ok)
    end

    it 'does not expose a portfolio from another tenant (IDOR)' do
      other = create(:organization, scheme: 'other-corp')
      portfolio = portfolio_in(other.id)

      get "/api/v1/portfolios/#{portfolio.id}/export", params: { format: 'json' }, headers: headers

      expect(response).to have_http_status(:not_found)
    end
  end

  describe 'GET /api/v1/portfolios/:id/fitgap/:vacancy_id' do
    it "does not expose another tenant's portfolio fit/gap" do
      other = create(:organization, scheme: 'other-corp')
      portfolio = portfolio_in(other.id)

      get "/api/v1/portfolios/#{portfolio.id}/fitgap/1", headers: headers

      expect(response).to have_http_status(:not_found)
    end
  end

  describe 'POST /api/v1/portfolios/:id/fitgap' do
    it 'starts generation by creating a generating report and returns it' do
      allow(FitGapGeneratorWorker).to receive(:perform_async)
      session = create(:session, tenant_id: org.id)
      portfolio = create(:portfolio, session: session, generation_status: 'complete')
      vacancy = create(:vacancy, tenant_id: org.id)

      post "/api/v1/portfolios/#{portfolio.id}/fitgap", params: { vacancy_id: vacancy.id }, headers: headers

      expect(response).to have_http_status(:accepted)
      report = FitGapReport.find_by(portfolio_id: portfolio.id, vacancy_id: vacancy.id)
      expect(report&.generation_status).to eq('generating')
      expect(JSON.parse(response.body).dig('report', 'generation_status')).to eq('generating')
      expect(FitGapGeneratorWorker).to have_received(:perform_async).with(portfolio.id, vacancy.id)
    end
  end

  describe 'POST /api/v1/portfolio_skills/:id/override' do
    it 'rejects overriding a portfolio skill from another tenant' do
      other = create(:organization, scheme: 'other-corp')
      session = create(:session, tenant_id: other.id)
      portfolio = create(:portfolio, session: session)
      skill = create(:portfolio_skill, portfolio: portfolio)

      post "/api/v1/portfolio_skills/#{skill.id}/override",
           params: { override: { override_level: 4 } },
           headers: headers

      expect(response).to have_http_status(:not_found)
    end
  end
end
