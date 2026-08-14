# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Api::V1::PortfolioSkills", type: :request do
  let(:own_org) { create(:organization) }
  let(:other_org) { create(:organization) }

  let(:own_session) { create(:session, assessment: create(:assessment, organization: own_org)) }
  let(:own_portfolio) { create(:portfolio, session: own_session) }
  let(:own_skill) { create(:portfolio_skill, portfolio: own_portfolio) }

  let(:other_session) { create(:session, assessment: create(:assessment, organization: other_org)) }
  let(:other_portfolio) { create(:portfolio, session: other_session) }
  let(:other_skill) { create(:portfolio_skill, portfolio: other_portfolio) }

  let(:headers) { auth_headers(organization: own_org) }

  describe "POST /api/v1/portfolio_skills/:id/override" do
    it "lets an assessor override a skill belonging to their own tenant" do
      post "/api/v1/portfolio_skills/#{own_skill.id}/override",
           params: { override: { override_level: 4, assessor_notes: "ok" } }, headers: headers

      expect(response).to have_http_status(:created)
      expect(own_skill.reload.assessor_override.override_level).to eq(4)
    end

    it "returns 404 instead of letting another tenant's candidate score be overwritten" do
      post "/api/v1/portfolio_skills/#{other_skill.id}/override",
           params: { override: { override_level: 1, assessor_notes: "malicious" } }, headers: headers

      expect(response).to have_http_status(:not_found)
      expect(other_skill.reload.assessor_override).to be_nil
    end
  end
end
