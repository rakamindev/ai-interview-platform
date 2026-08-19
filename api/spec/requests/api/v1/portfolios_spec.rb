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
end
