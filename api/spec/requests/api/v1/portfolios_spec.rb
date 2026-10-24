# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::Portfolios', type: :request do
  let(:organization) { create(:organization) }
  let(:user) { create(:user) }
  let(:assessment) { create(:assessment, tenant_id: organization.id) }
  let(:session) { create(:session, :ended, assessment: assessment, tenant_id: organization.id) }
  let(:portfolio) { create(:portfolio, session: session) }
  let(:vacancy) { create(:vacancy, tenant_id: organization.id) }
  let(:report) { create(:fit_gap_report, portfolio: portfolio, vacancy: vacancy) }
  let(:headers) { auth_headers(user_id: user.id, scheme: organization.scheme) }

  let(:other_organization) { create(:organization) }
  let(:other_assessment) { create(:assessment, tenant_id: other_organization.id) }
  let(:other_session) { create(:session, :ended, assessment: other_assessment, tenant_id: other_organization.id) }
  let(:other_portfolio) { create(:portfolio, session: other_session) }
  let(:other_vacancy) { create(:vacancy, tenant_id: other_organization.id) }
  let(:other_report) { create(:fit_gap_report, portfolio: other_portfolio, vacancy: other_vacancy) }

  describe 'GET /api/v1/sessions/:id/portfolio' do
    it 'returns the portfolio of a session in the current tenant' do
      portfolio

      get "/api/v1/sessions/#{session.id}/portfolio", headers: headers

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body.dig('portfolio', 'id')).to eq(portfolio.id)
    end

    it "does not expose another tenant's session portfolio" do
      other_portfolio

      get "/api/v1/sessions/#{other_session.id}/portfolio", headers: headers

      expect(response).to have_http_status(:not_found)
    end
  end

  describe 'GET /api/v1/portfolios/:id/export' do
    it 'exports a portfolio of the current tenant' do
      portfolio

      get "/api/v1/portfolios/#{portfolio.id}/export", headers: headers

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body.dig('portfolio', 'id')).to eq(portfolio.id)
    end

    it "does not export another tenant's portfolio" do
      other_portfolio

      get "/api/v1/portfolios/#{other_portfolio.id}/export", headers: headers

      expect(response).to have_http_status(:not_found)
    end
  end

  describe 'GET /api/v1/portfolios/:id/fitgap/:vacancy_id' do
    it 'returns the report of the current tenant' do
      report

      get "/api/v1/portfolios/#{portfolio.id}/fitgap/#{vacancy.id}", headers: headers

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body.dig('report', 'id')).to eq(report.id)
    end

    it "does not expose another tenant's report" do
      other_report

      get "/api/v1/portfolios/#{other_portfolio.id}/fitgap/#{other_vacancy.id}", headers: headers

      expect(response).to have_http_status(:not_found)
    end
  end

  describe 'POST /api/v1/portfolios/:id/fitgap' do
    it 'returns the cached report of the current tenant' do
      report

      post "/api/v1/portfolios/#{portfolio.id}/fitgap", params: { vacancy_id: vacancy.id }, headers: headers

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body.dig('report', 'id')).to eq(report.id)
    end

    it "does not queue generation against another tenant's portfolio" do
      other_portfolio

      post "/api/v1/portfolios/#{other_portfolio.id}/fitgap", params: { vacancy_id: vacancy.id }, headers: headers

      expect(response).to have_http_status(:not_found)
      expect(FitGapGeneratorWorker.jobs).to be_empty
    end
  end

  describe 'POST /api/v1/portfolios/:id/regenerate_fitgap' do
    it "does not delete another tenant's report" do
      other_report

      post "/api/v1/portfolios/#{other_portfolio.id}/regenerate_fitgap",
           params: { vacancy_id: vacancy.id }, headers: headers

      expect(response).to have_http_status(:not_found)
      expect(FitGapReport.exists?(other_report.id)).to be(true)
      expect(FitGapGeneratorWorker.jobs).to be_empty
    end
  end
end
