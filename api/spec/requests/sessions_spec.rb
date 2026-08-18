# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Candidate Sessions API", type: :request do
  describe "GET /api/v1/sessions/:token/candidate" do
    let(:tenant_id) { 123_456 }

    let!(:assessment) do
      Assessment.create!(
        tenant_id: tenant_id,
        created_by: 1,
        name: "Senior Full Stack Engineer",
        time_limit_min: 45
      )
    end

    let!(:session) do
      Session.create!(
        tenant_id: tenant_id,
        assessment: assessment,
        candidate_name: "Test Candidate"
      )
    end

    it "returns candidate information for a valid invite token" do
      get "/api/v1/sessions/#{session.invite_token}/candidate"

      expect(response).to have_http_status(:ok)

      body = JSON.parse(response.body)

      expect(body["session_id"]).to eq(session.id)
      expect(body["role_title"]).to eq("Senior Full Stack Engineer")
      expect(body["time_limit_min"]).to eq(45)
      expect(body["session_status"]).to eq("pending")
    end

    it "returns not found for an invalid invite token" do
      get "/api/v1/sessions/invalid-token/candidate"

      expect(response).to have_http_status(:not_found)

      body = JSON.parse(response.body)

      expect(body["errors"][0]["status"]).to eq(404)
      expect(body["errors"][0]["message"]).to eq("Invalid or expired invite token")
    end
  end
end
