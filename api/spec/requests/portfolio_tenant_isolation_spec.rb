# frozen_string_literal: true

require 'rails_helper'

RSpec.describe "Tenant isolation for portfolios", type: :request do
  let(:organization) { create(:organization) }
  let(:assessor) { create(:user, role: 'assessor') }
  let(:headers) { auth_headers(assessor, organization) }

  let(:own_assessment) { create(:assessment, organization: organization) }
  let(:own_session) { create(:session, assessment: own_assessment) }
  let(:own_portfolio) { create(:portfolio, session: own_session) }
  let!(:own_skill) { create(:portfolio_skill, portfolio: own_portfolio) }

  let(:other_organization) { create(:organization, scheme: 'other-tenant') }
  let(:other_assessment) { create(:assessment, organization: other_organization) }
  let(:other_session) { create(:session, assessment: other_assessment) }
  let(:other_portfolio) { create(:portfolio, session: other_session) }
  let!(:other_skill) { create(:portfolio_skill, portfolio: other_portfolio) }

  describe "GET /api/v1/sessions/:id/portfolio" do
    it "returns a portfolio inside the assessor's tenant" do
      get "/api/v1/sessions/#{own_session.id}/portfolio", headers: headers

      expect(response).to have_http_status(:ok)
      expect(json_body.dig('portfolio', 'session_id')).to eq(own_session.id)
    end

    it "does not expose another tenant's candidate portfolio" do
      get "/api/v1/sessions/#{other_session.id}/portfolio", headers: headers

      expect(response).to have_http_status(:not_found)
      expect(response.body).not_to include('competency_summary')
      expect(response.body).not_to include('evidence')
    end
  end

  describe "POST /api/v1/portfolio_skills/:id/override" do
    it "lets an assessor override a skill in their own tenant" do
      post "/api/v1/portfolio_skills/#{own_skill.id}/override",
           params: { override: { override_level: 4, assessor_notes: 'Stronger than the AI scored.' } },
           headers: headers

      expect(response).to have_http_status(:created)
      expect(json_body.dig('override', 'override_level')).to eq(4)
    end

    it "does not let an assessor write to another tenant's skill" do
      post "/api/v1/portfolio_skills/#{other_skill.id}/override",
           params: { override: { override_level: 5 } },
           headers: headers

      expect(response).to have_http_status(:not_found)
      expect(other_skill.reload.assessor_override).to be_nil
    end
  end
end
