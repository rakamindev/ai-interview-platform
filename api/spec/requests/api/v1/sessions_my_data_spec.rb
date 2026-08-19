# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Api::V1::Sessions#my_data", type: :request do
  let(:org) { create_test_organization }
  let(:assessment) { Current.using(tenant_id: org.id) { create(:assessment) } }
  let(:session_record) do
    Current.using(tenant_id: org.id) { create(:session, assessment: assessment, candidate_name: "Budi Santoso") }
  end

  describe "GET /sessions/:token/my_data" do
    it "returns the candidate's own name and transcript, no JWT required" do
      Current.using(tenant_id: org.id) { create(:transcript_turn, session: session_record, speaker: "candidate", text: "Hello there") }

      get "/api/v1/sessions/#{session_record.invite_token}/my_data"

      body = JSON.parse(response.body)
      expect(response).to have_http_status(:ok)
      expect(body["candidate_name"]).to eq("Budi Santoso")
      expect(body["transcript"]).to include({ "speaker" => "candidate", "text" => "Hello there" })
      expect(body["data_purged"]).to eq(false)
    end

    it "includes the verdict and skills when a portfolio exists" do
      portfolio = Current.using(tenant_id: org.id) { create(:portfolio, session: session_record, verdict: "pass") }
      Current.using(tenant_id: org.id) { create(:portfolio_skill, portfolio: portfolio, skill_label: "React", ai_level: 5) }

      get "/api/v1/sessions/#{session_record.invite_token}/my_data"

      body = JSON.parse(response.body)
      expect(body["verdict"]).to eq("pass")
      expect(body["skills"]).to include({ "skill_label" => "React", "ai_level" => 5 })
    end

    it "returns 404 for an unknown invite token" do
      get "/api/v1/sessions/does-not-exist/my_data"

      expect(response).to have_http_status(:not_found)
    end

    it "flags transcript_capture_failed when turn persistence failed during the interview" do
      session_record.update_column(:transcript_capture_failed_at, Time.current)

      get "/api/v1/sessions/#{session_record.invite_token}/my_data"

      expect(JSON.parse(response.body)["transcript_capture_failed"]).to eq(true)
    end
  end

  describe "POST /sessions/:token/my_data/delete" do
    it "purges the candidate's personal data" do
      Current.using(tenant_id: org.id) { create(:transcript_turn, session: session_record, text: "My name is Budi") }

      post "/api/v1/sessions/#{session_record.invite_token}/my_data/delete"

      expect(response).to have_http_status(:ok)
      expect(session_record.reload.candidate_name).to eq(Session::PURGED_NAME_MARKER)
      expect(session_record.transcript_turns.reload.pluck(:text)).to all(eq(Session::PURGED_TEXT_MARKER))
    end

    it "is idempotent when called twice" do
      post "/api/v1/sessions/#{session_record.invite_token}/my_data/delete"
      post "/api/v1/sessions/#{session_record.invite_token}/my_data/delete"

      expect(response).to have_http_status(:ok)
    end

    it "returns 404 for an unknown invite token" do
      post "/api/v1/sessions/does-not-exist/my_data/delete"

      expect(response).to have_http_status(:not_found)
    end

    it "reflects data_purged: true afterwards in my_data" do
      post "/api/v1/sessions/#{session_record.invite_token}/my_data/delete"

      get "/api/v1/sessions/#{session_record.invite_token}/my_data"

      expect(JSON.parse(response.body)["data_purged"]).to eq(true)
    end
  end
end
