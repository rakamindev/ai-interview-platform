require "rails_helper"

RSpec.describe "Portfolio tenant isolation", type: :request do
  let!(:org_a) { create(:organization) }
  let!(:org_b) { create(:organization) }

  let!(:session_a)         { create(:session, organization: org_a) }
  let!(:portfolio_a)       { create(:portfolio, session: session_a) }
  let!(:portfolio_skill_a) { create(:portfolio_skill, portfolio: portfolio_a) }

  let!(:vacancy_a) { create(:vacancy, organization: org_a) }
  let!(:vacancy_b) { create(:vacancy, organization: org_b) }

  let(:token_a) { auth_headers(scheme: org_a.scheme) }
  let(:token_b) { auth_headers(scheme: org_b.scheme) }

  it "has request examples for every portfolio endpoint" do
    controllers = %w[
      api/v1/portfolios
      api/v1/portfolio_skills
      ]

    routed_endpoints = Rails.application.routes.routes.filter_map do |route|
      next unless controllers.include?(route.defaults[:controller])
      
      path = route.path.spec.to_s.delete_suffix("(.:format)")
      "#{route.verb} #{path}"
    end

    tested_endpoints = self.class.children.filter_map do |group|
      description = group.description
      endpoint_description =
        description.match?(/\A(?:GET|POST|PUT|PATCH|DELETE) \//)

      description if endpoint_description && group.examples.any?
    end

    expect(tested_endpoints).to match_array(routed_endpoints)
  end

  describe "GET /api/v1/portfolios/:id/export" do
    it "allows the owning tenant" do
      get "/api/v1/portfolios/#{portfolio_a.id}/export", headers: token_a

      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body)["portfolio"]["id"]).to eq(portfolio_a.id)
    end

    it "blocks a different tenant" do
      get "/api/v1/portfolios/#{portfolio_a.id}/export", headers: token_b

      expect(response).to have_http_status(:not_found)
    end
  end

  describe "POST /api/v1/portfolios/:id/regenerate_fitgap" do
    it "allows the owning tenant" do
      post "/api/v1/portfolios/#{portfolio_a.id}/regenerate_fitgap",
           params: { vacancy_id: vacancy_a.id }, headers: token_a

      expect(response).to have_http_status(:accepted)
    end

    it "blocks a different tenant even when targeting a vacancy it legitimately owns" do
      post "/api/v1/portfolios/#{portfolio_a.id}/regenerate_fitgap",
           params: { vacancy_id: vacancy_b.id }, headers: token_b

      expect(response).to have_http_status(:not_found)
      expect(FitGapGeneratorWorker.jobs).to be_empty
    end
  end

  describe "POST /api/v1/portfolios/:id/fitgap" do
    it "allows the owning tenant" do
      post "/api/v1/portfolios/#{portfolio_a.id}/fitgap",
           params: { vacancy_id: vacancy_a.id }, headers: token_a

      expect(response).to have_http_status(:accepted)
    end

    it "blocks a different tenant even when targeting a vacancy it legitimately owns" do
      post "/api/v1/portfolios/#{portfolio_a.id}/fitgap",
           params: { vacancy_id: vacancy_b.id }, headers: token_b

      expect(response).to have_http_status(:not_found)
      expect(FitGapGeneratorWorker.jobs).to be_empty
    end
  end

  describe "GET /api/v1/portfolios/:id/fitgap/:vacancy_id" do
    let!(:fit_gap_report_a) do
      create(:fit_gap_report, portfolio: portfolio_a, vacancy: vacancy_a)
    end

    it "allows the owning tenant" do
      get "/api/v1/portfolios/#{portfolio_a.id}/fitgap/#{vacancy_a.id}", headers: token_a

      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body)["report"]["culture_narrative"]).to eq(fit_gap_report_a.culture_narrative)
    end

    it "blocks a different tenant" do
      get "/api/v1/portfolios/#{portfolio_a.id}/fitgap/#{vacancy_a.id}", headers: token_b

      expect(response).to have_http_status(:not_found)
    end
  end

  describe "POST /api/v1/portfolio_skills/:id/override" do
    let(:override_params) { { override: { override_level: 4, assessor_notes: "Looks solid." } } }

    it "allows the owning tenant to write an override" do
      expect do
        post "/api/v1/portfolio_skills/#{portfolio_skill_a.id}/override",
             params: override_params, headers: token_a
      end.to change(AssessorOverride, :count).by(1)

      expect(response).to have_http_status(:created)
    end

    it "blocks a different tenant from writing an override" do
      expect do
        post "/api/v1/portfolio_skills/#{portfolio_skill_a.id}/override",
             params: override_params, headers: token_b
      end.not_to change(AssessorOverride, :count)

      expect(response).to have_http_status(:not_found)
      expect(FitGapGeneratorWorker.jobs).to be_empty
    end
  end

  describe "GET /api/v1/sessions/:id/portfolio" do
    it "allows the owning tenant" do
      get "/api/v1/sessions/#{session_a.id}/portfolio",
          headers: token_a

      expect(response).to have_http_status(:ok)

      body = JSON.parse(response.body)
      expect(body["portfolio"]["id"]).to eq(portfolio_a.id)
      expect(body["portfolio"]["session_id"]).to eq(session_a.id)
    end

    it "blocks a different tenant" do
      get "/api/v1/sessions/#{session_a.id}/portfolio",
          headers: token_b

      expect(response).to have_http_status(:not_found)
      expect(JSON.parse(response.body)).not_to have_key("portfolio")
    end
  end

  describe "POST /api/v1/sessions/:id/portfolio/regenerate" do
      before do
        portfolio_a.update!(
          generation_status: "failed",
          generation_error: "Previous generation failed"
        )
    end

    it "allows the owning tenant to queue regeneration" do
      expect do
        post "/api/v1/sessions/#{session_a.id}/portfolio/regenerate",
            headers: token_a
      end.to change { PortfolioGeneratorWorker.jobs.size }.by(1)

      expect(response).to have_http_status(:ok)

      portfolio_a.reload
      expect(portfolio_a.generation_status).to eq("pending")
      expect(portfolio_a.generation_error).to be_nil
      expect(PortfolioGeneratorWorker.jobs.last["args"]).to eq([session_a.id])
    end

    it "blocks a different tenant without changing data or queuing a job" do
      original_attributes = portfolio_a.reload.attributes

      expect do
        post "/api/v1/sessions/#{session_a.id}/portfolio/regenerate",
            headers: token_b
      end.not_to change { PortfolioGeneratorWorker.jobs.size }

      expect(response).to have_http_status(:not_found)
      expect(portfolio_a.reload.attributes).to eq(original_attributes)
    end
  end
end
