# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Api::V1::Sessions", type: :request do
  let(:organization) { create(:organization) }
  let(:token) do
    JsonWebToken.encode({ user_id: 1, role: "assessor", scheme: organization.scheme })
  end
  let(:headers) { { "Authorization" => "Bearer #{token}" } }
  let(:assessment) { create(:assessment, organization:) }

  describe "PATCH /api/v1/sessions/:id" do
    it "renames the candidate" do
      session = create(:session, assessment:, candidate_name: "Old Name")

      patch "/api/v1/sessions/#{session.id}",
            params: { session: { candidate_name: "New Name" } },
            headers: headers

      expect(response).to have_http_status(:ok)
      expect(session.reload.candidate_name).to eq("New Name")
      expect(JSON.parse(response.body).dig("session", "candidate_name")).to eq("New Name")
    end

    it "returns 404 for a session belonging to another tenant" do
      other_assessment = create(:assessment)
      other_session = create(:session, assessment: other_assessment)

      patch "/api/v1/sessions/#{other_session.id}",
            params: { session: { candidate_name: "New Name" } },
            headers: headers

      expect(response).to have_http_status(:not_found)
    end
  end

  describe "POST /api/v1/assessments/:assessment_id/sessions" do
    it "defaults the invite to expire in 7 days" do
      post "/api/v1/assessments/#{assessment.id}/sessions", headers: headers

      body = JSON.parse(response.body)
      expires_at = Time.zone.parse(body["session"]["invite_expires_at"])
      expect(expires_at).to be_within(1.minute).of(7.days.from_now)
    end

    it "honors a custom invite_expiry_days" do
      post "/api/v1/assessments/#{assessment.id}/sessions",
           params: { session: { invite_expiry_days: 14 } }, headers: headers

      body = JSON.parse(response.body)
      expires_at = Time.zone.parse(body["session"]["invite_expires_at"])
      expect(expires_at).to be_within(1.minute).of(14.days.from_now)
    end
  end

  describe "POST /api/v1/sessions/:id/extend_invite" do
    it "pushes the expiry deadline further out" do
      session = create(:session, assessment:, status: "pending", invite_expires_at: 1.day.ago)

      post "/api/v1/sessions/#{session.id}/extend_invite", params: { days: 7 }, headers: headers

      expect(response).to have_http_status(:ok)
      expect(session.reload.expired?).to be false
    end

    it "refuses to extend a session that already started" do
      session = create(:session, assessment:, status: "active")

      post "/api/v1/sessions/#{session.id}/extend_invite", params: { days: 7 }, headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "returns 404 for a session belonging to another tenant" do
      other_session = create(:session, assessment: create(:assessment), status: "pending")

      post "/api/v1/sessions/#{other_session.id}/extend_invite", params: { days: 7 }, headers: headers

      expect(response).to have_http_status(:not_found)
    end
  end

  describe "GET /api/v1/assessments/:assessment_id/sessions" do
    it "paginates and includes meta" do
      create_list(:session, 3, assessment:)

      get "/api/v1/assessments/#{assessment.id}/sessions", params: { page: 1, per_page: 2 }, headers: headers

      body = JSON.parse(response.body)
      expect(response).to have_http_status(:ok)
      expect(body["sessions"].length).to eq(2)
      expect(body["meta"]).to eq(
        "current_page" => 1, "total_pages" => 2, "total_count" => 3, "per_page" => 2
      )
    end

    it "includes each pending invite's expiry deadline" do
      session = create(:session, assessment:, status: "pending")

      get "/api/v1/assessments/#{assessment.id}/sessions", headers: headers

      body = JSON.parse(response.body)
      expect(body["sessions"].first["invite_expires_at"]).to be_present
    end
  end

  describe "GET /api/v1/sessions/:token/candidate" do
    it "returns candidate info, including the invited name" do
      session = create(:session, assessment:, status: "pending", candidate_name: "Budi Santoso")

      get "/api/v1/sessions/#{session.invite_token}/candidate"

      body = JSON.parse(response.body)
      expect(response).to have_http_status(:ok)
      expect(body["candidate_name"]).to eq("Budi Santoso")
    end

    it "refuses an expired invite" do
      session = create(:session, assessment:, status: "pending", created_at: 8.days.ago)

      get "/api/v1/sessions/#{session.invite_token}/candidate"

      expect(response).to have_http_status(:not_found)
    end

    it "allows a session that's already started, even past the invite window" do
      session = create(:session, assessment:, status: "active", created_at: 8.days.ago)

      get "/api/v1/sessions/#{session.invite_token}/candidate"

      expect(response).to have_http_status(:ok)
    end

    it "includes started_at and the transcript so far for a resumed active session" do
      session = create(:session, assessment:, status: "active", started_at: 3.minutes.ago)
      create(:transcript_turn, session:, turn_number: 1, speaker: "ai", text: "Hi")

      get "/api/v1/sessions/#{session.invite_token}/candidate"

      body = JSON.parse(response.body)
      expect(body["started_at"]).to be_present
      expect(body["transcript"].length).to eq(1)
      expect(body["transcript"].first["text"]).to eq("Hi")
    end

    it "omits the transcript for a session that hasn't started yet" do
      session = create(:session, assessment:, status: "pending")

      get "/api/v1/sessions/#{session.invite_token}/candidate"

      body = JSON.parse(response.body)
      expect(body["transcript"]).to eq([])
    end
  end

  describe "POST /api/v1/sessions/:token/consent" do
    it "records proctoring consent with a timestamp" do
      session = create(:session, assessment:, status: "active")

      post "/api/v1/sessions/#{session.invite_token}/consent"

      expect(response).to have_http_status(:ok)
      expect(session.reload.proctoring_consented_at).to be_present
    end

    it "returns 404 for an invalid token" do
      post "/api/v1/sessions/nonexistent/consent"

      expect(response).to have_http_status(:not_found)
    end

    it "does not overwrite an existing consent timestamp" do
      session = create(:session, assessment:, status: "active", proctoring_consented_at: 1.day.ago)
      original = session.proctoring_consented_at

      post "/api/v1/sessions/#{session.invite_token}/consent"

      expect(session.reload.proctoring_consented_at).to eq(original)
    end
  end

  describe "POST /api/v1/sessions/:token/snapshot" do
    it "stores a proctoring snapshot when consent was recorded" do
      session = create(:session, assessment:, status: "active", proctoring_consented_at: Time.current)

      post "/api/v1/sessions/#{session.invite_token}/snapshot", params: { image: "base64imagedata" }

      expect(response).to have_http_status(:created)
      expect(session.session_snapshots.count).to eq(1)
    end

    it "refuses to store a snapshot without recorded consent" do
      session = create(:session, assessment:, status: "active", proctoring_consented_at: nil)

      post "/api/v1/sessions/#{session.invite_token}/snapshot", params: { image: "base64imagedata" }

      expect(response).to have_http_status(:forbidden)
      expect(session.session_snapshots.count).to eq(0)
    end

    it "returns 404 for an invalid token" do
      post "/api/v1/sessions/nonexistent/snapshot", params: { image: "base64imagedata" }

      expect(response).to have_http_status(:not_found)
    end

    it "stops accepting new snapshots once the per-session cap is reached" do
      session = create(:session, assessment:, status: "active", proctoring_consented_at: Time.current)
      Api::V1::SessionsController::MAX_SNAPSHOTS_PER_SESSION.times do
        create(:session_snapshot, session:)
      end

      post "/api/v1/sessions/#{session.invite_token}/snapshot", params: { image: "base64imagedata" }

      expect(response).to have_http_status(:ok)
      expect(session.session_snapshots.count).to eq(Api::V1::SessionsController::MAX_SNAPSHOTS_PER_SESSION)
    end
  end

  describe "GET /api/v1/sessions/:id/snapshots" do
    it "lists snapshots for the session" do
      session = create(:session, assessment:)
      create(:session_snapshot, session:, captured_at: 2.minutes.ago)
      create(:session_snapshot, session:, captured_at: 1.minute.ago)

      get "/api/v1/sessions/#{session.id}/snapshots", headers: headers

      body = JSON.parse(response.body)
      expect(response).to have_http_status(:ok)
      expect(body["snapshots"].length).to eq(2)
      expect(body["snapshots"].first).to include("image_data", "captured_at")
    end

    it "returns 404 for a session belonging to another tenant" do
      other_session = create(:session, assessment: create(:assessment))

      get "/api/v1/sessions/#{other_session.id}/snapshots", headers: headers

      expect(response).to have_http_status(:not_found)
    end
  end

  describe "DELETE /api/v1/sessions/:id" do
    it "deletes an ended session" do
      session = create(:session, assessment:, status: "ended")

      delete "/api/v1/sessions/#{session.id}", headers: headers

      expect(response).to have_http_status(:ok)
      expect(Session.unscoped.find_by(id: session.id)).to be_nil
    end

    it "deletes a pending session" do
      session = create(:session, assessment:, status: "pending")

      delete "/api/v1/sessions/#{session.id}", headers: headers

      expect(response).to have_http_status(:ok)
      expect(Session.unscoped.find_by(id: session.id)).to be_nil
    end

    it "blocks deleting a live session" do
      session = create(:session, assessment:, status: "active")

      delete "/api/v1/sessions/#{session.id}", headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
      expect(Session.unscoped.find_by(id: session.id)).to be_present
    end

    it "returns 404 for a session belonging to another tenant" do
      other_assessment = create(:assessment)
      other_session = create(:session, assessment: other_assessment)

      delete "/api/v1/sessions/#{other_session.id}", headers: headers

      expect(response).to have_http_status(:not_found)
    end
  end
end
