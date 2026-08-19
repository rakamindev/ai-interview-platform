# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Api::V1::Portfolios", type: :request do
  let(:organization) { create(:organization) }
  let(:assessment)    { create(:assessment, :with_skills, skills_count: 1, organization:) }
  let(:session)       { create(:session, assessment:) }
  let(:token) do
    JsonWebToken.encode({ user_id: 1, role: "admin", scheme: organization.scheme })
  end
  let(:headers) { { "Authorization" => "Bearer #{token}" } }

  describe "GET /api/v1/sessions/:id/portfolio" do
    it "includes each skill's status" do
      portfolio = create(:portfolio, session:, generation_status: "complete")
      create(:portfolio_skill, portfolio:, status: "rated")
      create(:portfolio_skill, :not_assessed, portfolio:)

      get "/api/v1/sessions/#{session.id}/portfolio", headers: headers

      expect(response).to have_http_status(:ok)
      statuses = JSON.parse(response.body).dig("portfolio", "skills").map { |s| s["status"] }
      expect(statuses).to contain_exactly("rated", "not_assessed")
    end
  end

  describe "cross-tenant isolation" do
    let(:other_organization) { create(:organization) }
    let(:other_assessment)   { create(:assessment, :with_skills, skills_count: 1, organization: other_organization) }
    let(:other_session)      { create(:session, assessment: other_assessment) }
    let(:other_portfolio)    { create(:portfolio, session: other_session, generation_status: "complete") }

    it "blocks exporting another tenant's portfolio" do
      get "/api/v1/portfolios/#{other_portfolio.id}/export", headers: headers

      expect(response).to have_http_status(:not_found)
    end

    it "blocks generating a fit/gap report for another tenant's portfolio" do
      vacancy = create(:vacancy, organization:)

      post "/api/v1/portfolios/#{other_portfolio.id}/fitgap", params: { vacancy_id: vacancy.id }, headers: headers

      expect(response).to have_http_status(:not_found)
    end

    it "blocks regenerating a fit/gap report for another tenant's portfolio" do
      vacancy = create(:vacancy, organization:)

      post "/api/v1/portfolios/#{other_portfolio.id}/regenerate_fitgap", params: { vacancy_id: vacancy.id }, headers: headers

      expect(response).to have_http_status(:not_found)
    end

    it "blocks reading another tenant's fit/gap report" do
      other_vacancy = create(:vacancy, organization: other_organization)
      FitGapReport.create!(
        portfolio: other_portfolio,
        vacancy: other_vacancy,
        skill_comparisons: [{ skill_label: "Ruby", required_level: 3, result: "match" }]
      )

      get "/api/v1/portfolios/#{other_portfolio.id}/fitgap/#{other_vacancy.id}", headers: headers

      expect(response).to have_http_status(:not_found)
    end
  end
end
