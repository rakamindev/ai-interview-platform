# frozen_string_literal: true

require "rails_helper"

# assessment/gap-analysis.md P1-4: a leaked/forwarded interview link worked
# forever — no expiry, only rate limiting.
RSpec.describe "Candidate invite expiry", type: :request do
  let(:organization) { create(:organization) }
  let(:assessment) { create(:assessment, organization: organization) }

  describe "GET /api/v1/sessions/:token/candidate" do
    it "returns session info for a fresh pending invite" do
      session = create(:session, assessment: assessment, status: "pending", created_at: 1.day.ago)

      get "/api/v1/sessions/#{session.invite_token}/candidate"

      expect(response).to have_http_status(:ok)
    end

    it "returns 410 Gone for an invite older than the TTL" do
      session = create(:session, assessment: assessment, status: "pending", created_at: 8.days.ago)

      get "/api/v1/sessions/#{session.invite_token}/candidate"

      expect(response).to have_http_status(:gone)
    end

    it "does not expire an already-active session's invite" do
      session = create(:session, assessment: assessment, status: "active", created_at: 8.days.ago)

      get "/api/v1/sessions/#{session.invite_token}/candidate"

      expect(response).to have_http_status(:ok)
    end
  end

  describe "POST /api/v1/sessions/:token/audio_complete" do
    it "returns 410 Gone for an invite older than the TTL" do
      session = create(:session, assessment: assessment, status: "pending", created_at: 8.days.ago)

      post "/api/v1/sessions/#{session.invite_token}/audio_complete"

      expect(response).to have_http_status(:gone)
    end
  end
end
