# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Api::V1::Portfolios", type: :request do
  let(:own_org) { create(:organization) }
  let(:other_org) { create(:organization) }

  let(:own_session) { create(:session, assessment: create(:assessment, organization: own_org)) }
  let(:own_portfolio) { create(:portfolio, session: own_session) }
  let!(:own_skill) { create(:portfolio_skill, portfolio: own_portfolio) }

  let(:other_session) { create(:session, assessment: create(:assessment, organization: other_org)) }
  let(:other_portfolio) { create(:portfolio, session: other_session) }

  let(:headers) { auth_headers(organization: own_org) }

  describe "GET /api/v1/portfolios/:id/export" do
    it "returns the portfolio when it belongs to the caller's tenant" do
      get "/api/v1/portfolios/#{own_portfolio.id}/export", headers: headers

      expect(response).to have_http_status(:ok)
    end

    it "returns 404 instead of leaking another tenant's candidate portfolio" do
      get "/api/v1/portfolios/#{other_portfolio.id}/export", headers: headers

      expect(response).to have_http_status(:not_found)
    end
  end

  describe "POST /api/v1/portfolios/:id/fitgap" do
    let(:own_vacancy) { create(:vacancy, organization: own_org) }

    it "queues generation for the caller's own portfolio" do
      post "/api/v1/portfolios/#{own_portfolio.id}/fitgap",
           params: { vacancy_id: own_vacancy.id }, headers: headers

      expect(response).to have_http_status(:accepted)
    end

    it "returns 404 for another tenant's portfolio instead of leaking it" do
      post "/api/v1/portfolios/#{other_portfolio.id}/fitgap",
           params: { vacancy_id: own_vacancy.id }, headers: headers

      expect(response).to have_http_status(:not_found)
    end
  end

  describe "POST /api/v1/portfolios/:id/regenerate_fitgap" do
    let(:own_vacancy) { create(:vacancy, organization: own_org) }

    it "returns 404 for another tenant's portfolio" do
      post "/api/v1/portfolios/#{other_portfolio.id}/regenerate_fitgap",
           params: { vacancy_id: own_vacancy.id }, headers: headers

      expect(response).to have_http_status(:not_found)
    end
  end

  describe "GET /api/v1/portfolios/:id/fitgap/:vacancy_id" do
    let(:own_vacancy) { create(:vacancy, organization: own_org) }
    let!(:own_report) { create(:fit_gap_report, portfolio: own_portfolio, vacancy: own_vacancy) }

    it "returns the report for the caller's own portfolio" do
      get "/api/v1/portfolios/#{own_portfolio.id}/fitgap/#{own_vacancy.id}", headers: headers

      expect(response).to have_http_status(:ok)
    end

    it "returns 404 for another tenant's portfolio" do
      get "/api/v1/portfolios/#{other_portfolio.id}/fitgap/#{own_vacancy.id}", headers: headers

      expect(response).to have_http_status(:not_found)
    end
  end
end
