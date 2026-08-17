# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Api::V1::Candidates", type: :request do
  let(:org) { create_test_organization }
  let(:other_org) { create_test_organization }
  let(:headers) { auth_headers_for(org) }

  let(:assessment) { Current.using(tenant_id: org.id) { create(:assessment) } }
  let(:other_assessment) { Current.using(tenant_id: other_org.id) { create(:assessment) } }

  def make_session(**attrs)
    Current.using(tenant_id: org.id) { create(:session, assessment: assessment, **attrs) }
  end

  describe "GET /api/v1/assessments/:assessment_id/candidates" do
    it "returns candidates for the assessment" do
      make_session(candidate_name: "Alice Wonderland")
      make_session(candidate_name: "Bob Builder")

      get "/api/v1/assessments/#{assessment.id}/candidates", headers: headers

      expect(response).to have_http_status(:ok)
      names = JSON.parse(response.body)["candidates"].map { |c| c["candidate_name"] }
      expect(names).to contain_exactly("Alice Wonderland", "Bob Builder")
    end

    it "searches by candidate name case-insensitively with surrounding whitespace" do
      make_session(candidate_name: "Alice Wonderland")
      make_session(candidate_name: "Bob Builder")

      get "/api/v1/assessments/#{assessment.id}/candidates", params: { search: "  alice  " }, headers: headers

      names = JSON.parse(response.body)["candidates"].map { |c| c["candidate_name"] }
      expect(names).to eq(["Alice Wonderland"])
    end

    it "filters by interview_status, translating completed to the ended enum value" do
      make_session(candidate_name: "Done", status: "ended", started_at: 1.day.ago)
      make_session(candidate_name: "Waiting", status: "pending")

      get "/api/v1/assessments/#{assessment.id}/candidates", params: { interview_status: "completed" }, headers: headers

      names = JSON.parse(response.body)["candidates"].map { |c| c["candidate_name"] }
      expect(names).to eq(["Done"])
    end

    it "rejects an invalid interview_status filter" do
      get "/api/v1/assessments/#{assessment.id}/candidates", params: { interview_status: "bogus" }, headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
      expect(JSON.parse(response.body)["errors"].first["message"]).to include("invalid interview_status")
    end

    it "filters by verdict" do
      session_pass = make_session(candidate_name: "Passer")
      Current.using(tenant_id: org.id) { create(:portfolio, session: session_pass, verdict: "pass") }
      session_fail = make_session(candidate_name: "Failer")
      Current.using(tenant_id: org.id) { create(:portfolio, session: session_fail, verdict: "failed") }

      get "/api/v1/assessments/#{assessment.id}/candidates", params: { verdict: "pass" }, headers: headers

      names = JSON.parse(response.body)["candidates"].map { |c| c["candidate_name"] }
      expect(names).to eq(["Passer"])
    end

    it "rejects an invalid verdict filter" do
      get "/api/v1/assessments/#{assessment.id}/candidates", params: { verdict: "maybe" }, headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "sorts by name ascending and breaks ties deterministically by id" do
      make_session(candidate_name: "Zed")
      make_session(candidate_name: "Amy")

      get "/api/v1/assessments/#{assessment.id}/candidates", params: { sort: "name", direction: "asc" }, headers: headers

      names = JSON.parse(response.body)["candidates"].map { |c| c["candidate_name"] }
      expect(names).to eq(["Amy", "Zed"])
    end

    it "rejects an invalid sort field" do
      get "/api/v1/assessments/#{assessment.id}/candidates", params: { sort: "shoe_size" }, headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "paginates results with metadata" do
      3.times { |n| make_session(candidate_name: "Candidate #{n}") }

      get "/api/v1/assessments/#{assessment.id}/candidates", params: { page: 1, per_page: 2 }, headers: headers

      body = JSON.parse(response.body)
      expect(body["candidates"].size).to eq(2)
      expect(body["meta"]["total_count"]).to eq(3)
      expect(body["meta"]["current_page"]).to eq(1)
    end

    it "does not leak candidates from another assessment's tenant" do
      make_session(candidate_name: "Mine")
      Current.using(tenant_id: other_org.id) { create(:session, assessment: other_assessment, candidate_name: "Theirs") }

      get "/api/v1/assessments/#{assessment.id}/candidates", headers: headers

      names = JSON.parse(response.body)["candidates"].map { |c| c["candidate_name"] }
      expect(names).to eq(["Mine"])
    end
  end

  describe "POST /api/v1/assessments/:assessment_id/candidates/export" do
    it "exports transcripts for the given candidate_ids" do
      session = make_session(candidate_name: "Alice")
      Current.using(tenant_id: org.id) do
        create(:transcript_turn, session: session, turn_number: 1, speaker: "ai", text: "Hello")
        create(:transcript_turn, session: session, turn_number: 2, speaker: "candidate", text: "Hi")
      end

      post "/api/v1/assessments/#{assessment.id}/candidates/export",
           params: { format: "transcript", candidate_ids: [session.id] }, headers: headers

      body = JSON.parse(response.body)
      expect(response).to have_http_status(:ok)
      expect(body["results"].first["status"]).to eq("ok")
      expect(body["results"].first["data"]["turns"].map { |t| t["text"] }).to eq(%w[Hello Hi])
    end

    it "exports json payload including verdict and effective skill levels" do
      session = make_session(candidate_name: "Alice")
      portfolio = Current.using(tenant_id: org.id) { create(:portfolio, session: session, verdict: "pass") }
      Current.using(tenant_id: org.id) { create(:portfolio_skill, portfolio: portfolio, ai_level: 4) }

      post "/api/v1/assessments/#{assessment.id}/candidates/export",
           params: { format: "json", candidate_ids: [session.id] }, headers: headers

      body = JSON.parse(response.body)
      expect(body["results"].first["data"]["verdict"]).to eq("pass")
      expect(body["results"].first["data"]["skills"].first["effective_level"]).to eq(4)
    end

    it "rejects an unsupported format" do
      session = make_session

      post "/api/v1/assessments/#{assessment.id}/candidates/export",
           params: { format: "pdf", candidate_ids: [session.id] }, headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "rejects an empty candidate_ids array" do
      post "/api/v1/assessments/#{assessment.id}/candidates/export",
           params: { format: "json", candidate_ids: [] }, headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "flags candidate_ids that do not belong to the assessment as errors instead of raising" do
      foreign_session = Current.using(tenant_id: other_org.id) { create(:session, assessment: other_assessment) }

      post "/api/v1/assessments/#{assessment.id}/candidates/export",
           params: { format: "json", candidate_ids: [foreign_session.id] }, headers: headers

      body = JSON.parse(response.body)
      expect(response).to have_http_status(:ok)
      expect(body["results"].first["status"]).to eq("error")
      expect(body["results"].first["error"]).to include("does not belong")
    end

    it "reports missing portfolio data as a per-candidate error, not a failure of the whole export" do
      session = make_session(candidate_name: "NoPortfolio")

      post "/api/v1/assessments/#{assessment.id}/candidates/export",
           params: { format: "json", candidate_ids: [session.id] }, headers: headers

      body = JSON.parse(response.body)
      expect(body["results"].first["status"]).to eq("error")
      expect(body["results"].first["error"]).to include("Portfolio not available")
    end
  end
end
