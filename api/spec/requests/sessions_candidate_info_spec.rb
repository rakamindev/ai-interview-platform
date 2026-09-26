# frozen_string_literal: true

require 'rails_helper'

RSpec.describe "Api::V1::Sessions — candidate_info", type: :request do
  # The candidate_info endpoint is public (no JWT required).
  # It resolves the session via invite_token in the URL.

  let(:organization) { create(:organization) }
  let(:assessment)   { create(:assessment, tenant_id: organization.id) }
  let(:session)      { create(:session, assessment: assessment, tenant_id: organization.id) }

  # The endpoint requires tenant resolution from the Host header
  let(:headers) { { "Host" => organization.host } }

  describe "GET /sessions/:token/candidate" do
    context "with a valid invite token" do
      it "returns 200 with the expected fields" do
        get "/api/v1/sessions/#{session.invite_token}/candidate", headers: headers

        expect(response).to have_http_status(:ok)
        json = JSON.parse(response.body)

        expect(json["session_id"]).to eq(session.id)
        expect(json["role_title"]).to eq(assessment.name)
        expect(json["time_limit_min"]).to eq(assessment.time_limit_min)
        expect(json["session_status"]).to eq(session.status)
      end

      it "returns candidate_name when the session has one" do
        session.update!(candidate_name: "Budi Santoso")

        get "/api/v1/sessions/#{session.invite_token}/candidate", headers: headers

        json = JSON.parse(response.body)
        # P1-3 fix: candidate_name is now included in the response
        expect(json["candidate_name"]).to eq("Budi Santoso")
      end

      it "returns null for candidate_name when the session has none" do
        session.update!(candidate_name: nil)

        get "/api/v1/sessions/#{session.invite_token}/candidate", headers: headers

        json = JSON.parse(response.body)
        expect(json.key?("candidate_name")).to be(true)
        expect(json["candidate_name"]).to be_nil
      end
    end

    context "with an invalid invite token" do
      it "returns 404" do
        get "/api/v1/sessions/invalid_token_xyz/candidate", headers: headers
        expect(response).to have_http_status(:not_found)
      end
    end

    context "with an ended session" do
      before { session.update!(status: "ended") }

      it "still returns the session info (so the frontend can show the complete screen)" do
        get "/api/v1/sessions/#{session.invite_token}/candidate", headers: headers

        expect(response).to have_http_status(:ok)
        json = JSON.parse(response.body)
        expect(json["session_status"]).to eq("ended")
      end
    end
  end
end
