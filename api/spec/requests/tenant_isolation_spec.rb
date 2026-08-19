# frozen_string_literal: true

require "rails_helper"

# rubocop:disable RSpec/MultipleMemoizedHelpers
RSpec.describe "Tenant isolation", type: :request do
  let(:org_a) { create(:organization, scheme: "org-a") }
  let(:org_b) { create(:organization, :rival) }

  let(:user_a) { create(:user, role: "admin") }
  let(:user_b) { create(:user, role: "admin") }

  let(:assessment_a) { create(:assessment, tenant_id: org_a.id) }
  let(:assessment_b) { create(:assessment, tenant_id: org_b.id) }

  let(:session_a) { create(:session, assessment: assessment_a, tenant_id: org_a.id) }
  let(:session_b) { create(:session, assessment: assessment_b, tenant_id: org_b.id) }

  let(:portfolio_a) { create(:portfolio, session: session_a, tenant_id: org_a.id) }
  let(:portfolio_b) { create(:portfolio, session: session_b, tenant_id: org_b.id) }

  let(:portfolio_skill_a) { create(:portfolio_skill, portfolio: portfolio_a, tenant_id: org_a.id) }
  let(:portfolio_skill_b) { create(:portfolio_skill, portfolio: portfolio_b, tenant_id: org_b.id) }

  let(:headers_a) { jwt_for(user: user_a, scheme: org_a.scheme) }
  let(:headers_b) { jwt_for(user: user_b, scheme: org_b.scheme) }

  describe "AC-4.1: cross-tenant portfolio access" do
    it "returns 404 when assessor A requests tenant B portfolio" do
      get "/api/v1/portfolios/#{portfolio_b.id}", headers: headers_a

      expect(response).to have_http_status(:not_found)
    end

    it "returns 404 when assessor B requests tenant A portfolio" do
      get "/api/v1/portfolios/#{portfolio_a.id}", headers: headers_b

      expect(response).to have_http_status(:not_found)
    end
  end

  describe "AC-4.2: cross-tenant PDF/JSON export" do
    it "returns 404 when assessor A exports tenant B portfolio" do
      get "/api/v1/portfolios/#{portfolio_b.id}/export", headers: headers_a

      expect(response).to have_http_status(:not_found)
    end

    it "returns 404 when assessor B exports tenant A portfolio" do
      get "/api/v1/portfolios/#{portfolio_a.id}/export", headers: headers_b

      expect(response).to have_http_status(:not_found)
    end
  end

  describe "AC-4.3: cross-tenant fit/gap POST" do
    let(:vacancy_a) { create(:vacancy, tenant_id: org_a.id) }

    it "returns 404 when assessor A posts fit/gap for tenant B portfolio" do
      post "/api/v1/portfolios/#{portfolio_b.id}/fitgap",
           params: { vacancy_id: vacancy_a.id },
           headers: headers_a

      expect(response).to have_http_status(:not_found)
    end
  end

  describe "AC-4.4: cross-tenant override" do
    it "returns 404 when assessor A overrides tenant B portfolio skill" do
      post "/api/v1/portfolio-skills/#{portfolio_skill_b.id}/override",
           params: { override: { override_level: 4, assessor_notes: "Override" } },
           headers: headers_a

      expect(response).to have_http_status(:not_found)
    end
  end

  describe "AC-4.5: cross-tenant fit/gap report read" do
    let(:vacancy_a) { create(:vacancy, tenant_id: org_a.id) }
    let!(:report_b) do
      create(:fit_gap_report, portfolio: portfolio_b, vacancy: vacancy_a, tenant_id: org_b.id)
    end

    it "returns 404 when assessor A reads tenant B fit/gap report" do
      get "/api/v1/portfolios/#{portfolio_b.id}/fitgap/#{vacancy_a.id}",
          headers: headers_a

      expect(response).to have_http_status(:not_found)
    end
  end

  describe "AC-4.10: response body reveals nothing" do
    it "returns a generic 404 message" do
      get "/api/v1/portfolios/#{portfolio_b.id}", headers: headers_a

      body = response.parsed_body
      expect(body["message"]).to be_present
      expect(body["message"]).not_to include("portfolio")
      expect(body["message"]).not_to include("tenant")
    end
  end
end
# rubocop:enable RSpec/MultipleMemoizedHelpers
