# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Api::V1::Assessments", type: :request do
  let(:organization) { create(:organization) }
  let(:token) do
    JsonWebToken.encode({ user_id: 1, role: "assessor", scheme: organization.scheme })
  end
  let(:headers) { { "Authorization" => "Bearer #{token}" } }

  describe "GET /api/v1/assessments" do
    it "includes the candidate session count for each assessment" do
      assessment = create(:assessment, organization:)
      create_list(:session, 2, assessment:)

      get "/api/v1/assessments", headers: headers

      body = JSON.parse(response.body)
      json = body["assessments"].find { |a| a["id"] == assessment.id }

      expect(response).to have_http_status(:ok)
      expect(json["sessions_count"]).to eq(2)
    end

    it "includes the skill labels for each assessment, in display order" do
      assessment = create(:assessment, organization:)
      create(:assessment_skill, assessment:, skill_label: "Second", display_order: 1)
      create(:assessment_skill, assessment:, skill_label: "First", display_order: 0)

      get "/api/v1/assessments", headers: headers

      body = JSON.parse(response.body)
      json = body["assessments"].find { |a| a["id"] == assessment.id }

      expect(json["skill_labels"]).to eq(%w[First Second])
    end

    it "includes tenant-wide candidate stats regardless of the current page" do
      first_assessment = create(:assessment, organization:)
      second_assessment = create(:assessment, organization:)
      create_list(:session, 2, assessment: first_assessment, status: "ended")
      create(:session, assessment: second_assessment, status: "active")

      get "/api/v1/assessments", params: { page: 2, per_page: 1 }, headers: headers

      body = JSON.parse(response.body)
      expect(body["stats"]).to eq("total_candidates" => 3, "live_now" => 1)
    end
  end

  describe "GET /api/v1/assessments search" do
    it "filters by name, case-insensitively" do
      create(:assessment, organization:, name: "Backend Engineer")
      create(:assessment, organization:, name: "Data Analyst")

      get "/api/v1/assessments", params: { q: "backend" }, headers: headers

      names = JSON.parse(response.body)["assessments"].map { |a| a["name"] }
      expect(names).to eq(["Backend Engineer"])
    end

    it "returns everything when q is blank" do
      create_list(:assessment, 2, organization:)

      get "/api/v1/assessments", params: { q: "" }, headers: headers

      expect(JSON.parse(response.body)["assessments"].size).to eq(2)
    end
  end

  describe "attribution" do
    it "records who created the assessment" do
      user = create(:user)
      creator_token = JsonWebToken.encode({ user_id: user.id, role: "assessor", scheme: organization.scheme })

      post "/api/v1/assessments",
           params: { assessment: { name: "New Assessment", time_limit_min: 30 } },
           headers: { "Authorization" => "Bearer #{creator_token}" }

      json = JSON.parse(response.body)["assessment"]
      expect(json["updated_by_email"]).to eq(user.email)
    end

    it "records who last updated the assessment" do
      creator = create(:user)
      editor = create(:user)
      assessment = create(:assessment, organization:, created_by: creator.id)
      editor_token = JsonWebToken.encode({ user_id: editor.id, role: "assessor", scheme: organization.scheme })

      put "/api/v1/assessments/#{assessment.id}",
          params: { assessment: { name: assessment.name, time_limit_min: assessment.time_limit_min } },
          headers: { "Authorization" => "Bearer #{editor_token}" }

      json = JSON.parse(response.body)["assessment"]
      expect(json["updated_by_email"]).to eq(editor.email)
    end
  end

  describe "GET /api/v1/assessments sort order" do
    it "orders by most recently updated first, not by creation order" do
      # Created first (so it has the earlier created_at) but touched more recently.
      recently_updated = create(:assessment, organization:, updated_at: 1.day.ago)
      # Created second (later created_at) but untouched since — the older edit.
      stale = create(:assessment, organization:, updated_at: 5.days.ago)

      get "/api/v1/assessments", headers: headers

      ids = JSON.parse(response.body)["assessments"].map { |a| a["id"] }
      expect(ids.index(recently_updated.id)).to be < ids.index(stale.id)
    end
  end

  describe "PUT /api/v1/assessments/:id" do
    it "removes a skill when it's sent with _destroy: true" do
      assessment = create(:assessment, organization:)
      keep = create(:assessment_skill, assessment:, skill_label: "Keep", display_order: 0)
      drop = create(:assessment_skill, assessment:, skill_label: "Drop", display_order: 1)

      put "/api/v1/assessments/#{assessment.id}",
          params: {
            assessment: {
              name: assessment.name,
              time_limit_min: assessment.time_limit_min,
              assessment_skills_attributes: [
                { id: keep.id, skill_label: "Keep", is_custom: false, expected_level: 3, display_order: 0 },
                { id: drop.id, _destroy: true }
              ]
            }
          },
          headers: headers

      expect(response).to have_http_status(:ok)
      expect(assessment.assessment_skills.reload.pluck(:skill_label)).to eq(["Keep"])
    end
  end

  describe "DELETE /api/v1/assessments/:id" do
    it "refuses to delete an assessment with existing sessions" do
      assessment = create(:assessment, organization:)
      create(:session, assessment:)

      delete "/api/v1/assessments/#{assessment.id}", headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
      expect(Assessment.find_by(id: assessment.id)).to be_present
    end
  end
end
