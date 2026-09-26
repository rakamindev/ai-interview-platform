# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Api::V1::Sessions", type: :request do
  let(:own_org) { create(:organization) }
  let(:other_org) { create(:organization) }
  let(:own_assessment) { create(:assessment, organization: own_org) }
  let(:other_assessment) { create(:assessment, organization: other_org) }
  let(:headers) { auth_headers(organization: own_org) }

  before { allow_any_instance_of(Sessions::EndHandler).to receive(:publish_status_update) }

  describe "authentication" do
    it "rejects requests without a token" do
      get "/api/v1/sessions"

      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "POST /api/v1/assessments/:id/sessions" do
    it "creates a pending session and returns a frontend invite url" do
      post "/api/v1/assessments/#{own_assessment.id}/sessions",
           params: { session: { candidate_name: "Siti" } }, headers: headers

      expect(response).to have_http_status(:created)
      expect(JSON.parse(response.body)["invite_url"]).to include("/interview/")
    end

    it "returns 404 for another tenant's assessment" do
      post "/api/v1/assessments/#{other_assessment.id}/sessions",
           params: { session: { candidate_name: "Siti" } }, headers: headers

      expect(response).to have_http_status(:not_found)
    end
  end

  describe "GET /api/v1/sessions" do
    it "lists only the caller's tenant sessions" do
      own = create(:session, assessment: own_assessment)
      create(:session, assessment: other_assessment)

      get "/api/v1/sessions", headers: headers

      ids = JSON.parse(response.body)["sessions"].map { |s| s["id"] }
      expect(ids).to eq([own.id])
    end
  end

  describe "tenant isolation on member routes" do
    let(:foreign) { create(:session, assessment: other_assessment) }

    %w[show coverage transcript].each do |action|
      it "returns 404 for another tenant's session (#{action})" do
        path = action == "show" ? "/api/v1/sessions/#{foreign.id}" : "/api/v1/sessions/#{foreign.id}/#{action}"
        get path, headers: headers

        expect(response).to have_http_status(:not_found)
      end
    end

    it "does not let a tenant end another tenant's session" do
      post "/api/v1/sessions/#{foreign.id}/end_session", headers: headers

      expect(response).to have_http_status(:not_found)
    end
  end

  describe "POST /api/v1/sessions/:id/end_session" do
    let(:session) { create(:session, assessment: own_assessment, status: "active", ended_at: nil) }

    it "ends an active session" do
      post "/api/v1/sessions/#{session.id}/end_session", headers: headers

      expect(response).to have_http_status(:ok)
      expect(session.reload).to be_ended
    end

    it "rejects an invalid end reason" do
      post "/api/v1/sessions/#{session.id}/end_session", params: { session: { reason: "banana" } }, headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
      expect(session.reload).to be_active
    end

    it "rejects ending an already-ended session" do
      ended = create(:session, assessment: own_assessment)

      post "/api/v1/sessions/#{ended.id}/end_session", headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
    end
  end

  describe "POST /sessions/:token/audio_complete (public)" do
    let(:session) { create(:session, assessment: own_assessment, status: "active", ended_at: nil) }

    it "ends the session once and is idempotent on repeat" do
      2.times { post "/api/v1/sessions/#{session.invite_token}/audio_complete" }

      expect(response).to have_http_status(:ok)
      expect(session.reload.end_reason).to eq("all_covered")
      expect(PortfolioGeneratorWorker.jobs.size).to eq(1)
    end

    it "does not end a session that never started (a leaked invite link must not burn the interview)" do
      unstarted = create(:session, assessment: own_assessment, status: "pending", ended_at: nil)

      post "/api/v1/sessions/#{unstarted.invite_token}/audio_complete"

      expect(response).to have_http_status(:conflict)
      expect(unstarted.reload).to be_pending
      expect(PortfolioGeneratorWorker.jobs).to be_empty
    end

    it "returns 404 for an unknown token" do
      post "/api/v1/sessions/nope/audio_complete"

      expect(response).to have_http_status(:not_found)
    end

    it "returns 410 for an expired pending invite" do
      stale = create(:session, assessment: own_assessment, status: "pending", ended_at: nil, created_at: 8.days.ago)

      post "/api/v1/sessions/#{stale.invite_token}/audio_complete"

      expect(response).to have_http_status(:gone)
    end
  end
end
