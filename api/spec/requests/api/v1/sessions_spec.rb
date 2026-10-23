# frozen_string_literal: true

require 'rails_helper'

RSpec.describe "Api::V1::Sessions", type: :request do
  let!(:org) do
    Organization.find_by(scheme: 'test-corp') || Organization.create!(
      name: 'Test Corp',
      scheme: 'test-corp',
      identifier: 'test-corp-id',
      host: 'localhost'
    )
  end
  let!(:user) { User.create!(email: "assessor@test.com", password_digest: BCrypt::Password.create("secret123"), role: "admin") }
  let!(:assessment) do
    Assessment.create!(
      name: "Fullstack Engineer",
      tenant_id: org.id,
      created_by: user.id,
      time_limit_min: 30
    )
  end
  let(:headers) { authenticated_headers('admin', org) }

  describe "POST /api/v1/assessments/:assessment_id/sessions" do
    context "when assessment has no skills configured" do
      it "returns 422 with a clear descriptive error" do
        post "/api/v1/assessments/#{assessment.id}/sessions",
             params: { session: { candidate_name: "Budi Santoso" } }.to_json,
             headers: headers

        expect(response).to have_http_status(:unprocessable_entity)
        json = JSON.parse(response.body)
        error_message = json.dig("errors", 0, "message") || json["error"]
        expect(error_message).to eq("Assessment must have at least one configured skill before creating a session.")
      end
    end

    context "when assessment has skills configured" do
      before do
        assessment.assessment_skills.create!(
          skill_label: "Ruby on Rails",
          l1_anchor: "Basic",
          l2_anchor: "Intermediate",
          l3_anchor: "Proficient",
          l4_anchor: "Advanced",
          l5_anchor: "Expert"
        )
      end

      it "creates the session successfully and generates invite URL" do
        post "/api/v1/assessments/#{assessment.id}/sessions",
             params: { session: { candidate_name: "Budi Santoso" } }.to_json,
             headers: headers

        expect(response).to have_http_status(:created)
        json = JSON.parse(response.body)
        expect(json["session"]["candidate_name"]).to eq("Budi Santoso")
        expect(json["session"]["status"]).to eq("pending")
        expect(json["invite_url"]).to be_present
      end
    end
  end

  describe "GET /api/v1/sessions/:token/candidate" do
    let!(:session) do
      assessment.assessment_skills.create!(
        skill_label: "Ruby on Rails",
        l1_anchor: "L1", l2_anchor: "L2", l3_anchor: "L3", l4_anchor: "L4", l5_anchor: "L5"
      )
      assessment.sessions.create!(
        tenant_id: org.id,
        candidate_name: "Siti Rahma"
      )
    end

    it "returns candidate session details without authentication" do
      get "/api/v1/sessions/#{session.invite_token}/candidate", headers: { 'X-Tenant-Scheme' => org.scheme }

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json["session_id"]).to eq(session.id)
      expect(json["role_title"]).to eq("Fullstack Engineer")
      expect(json["time_limit_min"]).to eq(30)
      expect(json["session_status"]).to eq("pending")
    end

    it "returns 404 for invalid token" do
      get "/api/v1/sessions/invalid-token-123/candidate", headers: { 'X-Tenant-Scheme' => org.scheme }

      expect(response).to have_http_status(:not_found)
    end
  end
end
