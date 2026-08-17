# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Api::V1::Portfolios", type: :request do
  let(:org) { create_test_organization }
  let(:headers) { auth_headers_for(org) }
  let(:assessment) { Current.using(tenant_id: org.id) { create(:assessment) } }
  let(:session) { Current.using(tenant_id: org.id) { create(:session, assessment: assessment) } }

  describe "GET /api/v1/sessions/:id/portfolio" do
    it "includes the persisted verdict in the response" do
      portfolio = Current.using(tenant_id: org.id) { create(:portfolio, session: session, verdict: "pass") }
      Current.using(tenant_id: org.id) { create(:portfolio_skill, portfolio: portfolio, ai_level: 5) }

      get "/api/v1/sessions/#{session.id}/portfolio", headers: headers

      body = JSON.parse(response.body)
      expect(body["portfolio"]["verdict"]).to eq("pass")
    end

    it "returns a nil verdict when the portfolio has no assessed skills yet" do
      Current.using(tenant_id: org.id) { create(:portfolio, session: session, verdict: nil) }

      get "/api/v1/sessions/#{session.id}/portfolio", headers: headers

      body = JSON.parse(response.body)
      expect(body["portfolio"]["verdict"]).to be_nil
    end

    it "still includes verdict when the portfolio failed to generate" do
      Current.using(tenant_id: org.id) do
        create(:portfolio, session: session, generation_status: "failed", generation_error: "boom", verdict: nil)
      end

      get "/api/v1/sessions/#{session.id}/portfolio", headers: headers

      body = JSON.parse(response.body)
      expect(body["portfolio"]).to have_key("verdict")
    end
  end
end
