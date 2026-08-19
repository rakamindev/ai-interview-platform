# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Api::V1::PortfolioSkills", type: :request do
  let(:organization) { create(:organization) }
  let(:token) do
    JsonWebToken.encode({ user_id: 1, role: "admin", scheme: organization.scheme })
  end
  let(:headers) { { "Authorization" => "Bearer #{token}" } }

  describe "POST /api/v1/portfolio_skills/:id/override" do
    it "blocks overriding another tenant's portfolio skill" do
      other_organization = create(:organization)
      other_assessment    = create(:assessment, :with_skills, skills_count: 1, organization: other_organization)
      other_session       = create(:session, assessment: other_assessment)
      other_portfolio     = create(:portfolio, session: other_session, generation_status: "complete")
      other_skill         = create(:portfolio_skill, portfolio: other_portfolio)

      post "/api/v1/portfolio_skills/#{other_skill.id}/override",
           params: { override: { override_level: 4, assessor_notes: "test" } },
           headers: headers

      expect(response).to have_http_status(:not_found)
      expect(other_skill.reload.assessor_override).to be_nil
    end
  end
end
