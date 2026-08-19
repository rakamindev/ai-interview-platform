require "rails_helper"

RSpec.describe "API::V1::Portfolios", type: :request do
  let(:organization) { create(:organization) }
  let(:assessment)   { create(:assessment, organization: organization) }
  let(:session)      { create(:session, assessment: assessment) }
  let(:headers)      { auth_headers(organization) }

  describe "GET /api/v1/sessions/:id/portfolio" do
    context "when the portfolio is complete and Gemini dropped a configured skill" do
      let(:portfolio) { create(:portfolio, session: session, generation_status: "complete") }

      before do
        create(:assessment_skill, assessment: assessment, skill_id: "sk-1", skill_label: "React")
        create(:assessment_skill, assessment: assessment, skill_id: "sk-2", skill_label: "SQL")
        create(:portfolio_skill, portfolio: portfolio, skill_id: "sk-1", skill_label: "React", is_discovered: false)
      end

      it "surfaces the dropped skill as a not-assessed placeholder instead of omitting it" do
        get "/api/v1/sessions/#{session.id}/portfolio", headers: headers

        expect(response).to have_http_status(:ok)
        skills = JSON.parse(response.body)["portfolio"]["skills"]

        expect(skills.map { |s| s["skill_label"] }).to contain_exactly("React", "SQL")

        sql_entry = skills.find { |s| s["skill_label"] == "SQL" }
        expect(sql_entry["is_assessed"]).to eq(false)
        expect(sql_entry["ai_level"]).to be_nil

        react_entry = skills.find { |s| s["skill_label"] == "React" }
        expect(react_entry["is_assessed"]).to eq(true)
        expect(react_entry["ai_level"]).to eq(3)
      end
    end

    context "when the portfolio is still generating" do
      it "returns 202 without touching missing-skill reconciliation" do
        create(:portfolio, session: session, generation_status: "generating")

        get "/api/v1/sessions/#{session.id}/portfolio", headers: headers

        expect(response).to have_http_status(:accepted)
        expect(JSON.parse(response.body)["status"]).to eq("generating")
      end
    end

    context "when no portfolio exists yet" do
      it "returns 202 generating" do
        get "/api/v1/sessions/#{session.id}/portfolio", headers: headers

        expect(response).to have_http_status(:accepted)
      end
    end

    context "when the session does not exist" do
      it "returns 404, not a silent empty body" do
        get "/api/v1/sessions/999999/portfolio", headers: headers

        expect(response).to have_http_status(:not_found)
      end
    end

    context "without a valid auth token" do
      it "returns 401" do
        # Resolve tenant via header so the failure we assert on is auth, not tenant lookup.
        get "/api/v1/sessions/#{session.id}/portfolio",
            headers: { "X-Tenant-Scheme" => organization.scheme }

        expect(response).to have_http_status(:unauthorized)
      end
    end
  end
end
