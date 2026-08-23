# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Candidate Info", type: :request do
  let(:org) { create(:organization, scheme: "test-corp") }
  let(:assessment) { create(:assessment, tenant_id: org.id) }
  let(:session) { create(:session, assessment: assessment, tenant_id: org.id, status: "pending", end_reason: nil) }

  before do
    session.update_column(:invite_expires_at, 14.days.from_now)
  end

  describe "GET /api/v1/sessions/:token/candidate" do
    context "with a valid invite token" do
      it "returns 200 with candidate info" do
        get "/api/v1/sessions/#{session.invite_token}/candidate"

        expect(response).to have_http_status(:ok)
        body = response.parsed_body
        expect(body["session_id"]).to eq(session.id)
        expect(body["role_title"]).to eq(assessment.name)
        expect(body["time_limit_min"]).to eq(assessment.time_limit_min)
        expect(body["session_status"]).to eq("pending")
      end
    end

    context "with an invalid invite token" do
      it "returns 404 with invite_invalid code" do
        get "/api/v1/sessions/does-not-exist/candidate"

        expect(response).to have_http_status(:not_found)
        body = response.parsed_body
        expect(body.dig("errors", 0, "code")).to eq("invite_invalid")
      end
    end

    context "with an expired invite token" do
      it "returns 401 with invite_expired code" do
        session.update_column(:invite_expires_at, 1.day.ago)

        get "/api/v1/sessions/#{session.invite_token}/candidate"

        expect(response).to have_http_status(:unauthorized)
        body = response.parsed_body
        expect(body.dig("errors", 0, "code")).to eq("invite_expired")
      end
    end

    context "when the assessment is missing" do
      it "returns 404 with assessment_not_found code" do
        # Create a session with a deleted assessment
        orphan_session = create(:session, tenant_id: org.id, status: "pending", end_reason: nil)
        orphan_session.update_column(:invite_expires_at, 14.days.from_now)
        # Delete the assessment
        Assessment.unscoped.where(id: orphan_session.assessment_id).delete_all

        get "/api/v1/sessions/#{orphan_session.invite_token}/candidate"

        expect(response).to have_http_status(:not_found)
        body = response.parsed_body
        expect(body.dig("errors", 0, "code")).to eq("assessment_not_found")
      end
    end

    context "when the session has already ended" do
      it "returns 200 with session_status ended" do
        session.update!(status: "ended")

        get "/api/v1/sessions/#{session.invite_token}/candidate"

        expect(response).to have_http_status(:ok)
        body = response.parsed_body
        expect(body["session_status"]).to eq("ended")
      end
    end
  end
end
