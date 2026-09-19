# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Portfolio export", type: :request do
  let(:organization) { create(:organization, scheme: "test-scheme") }
  let(:tenant_id) { organization.id }

  let(:assessment) { create(:assessment, tenant_id: tenant_id, name: "Backend Engineering — 2026 → 2027") }
  let(:session) { create(:session, tenant_id: tenant_id, assessment: assessment) }
  let(:portfolio) { create(:portfolio, session: session, generation_status: "complete") }
  let(:vacancy) { create(:vacancy, tenant_id: tenant_id, role_title: "Senior Rails Engineer → Team Lead") }
  let!(:portfolio_skill) do
    create(
      :portfolio_skill,
      portfolio:         portfolio,
      skill_label:       "Ruby on Rails ★",
      competency_summary: "Fluent in Ruby… writes clean code — no exceptions 🚀",
      evidence:          ["“Ships fast” (→ 40%)…", "Covers edge cases ≥ 95%"]
    )
  end
  let(:report) do
    create(
      :fit_gap_report,
      portfolio:         portfolio,
      vacancy:           vacancy,
      culture_narrative: "Strong cultural alignment… (≈ 92%)",
      overall_narrative: "Recommended → hire. Rémi outperforms peers."
    )
  end

  before do
    report
    allow(AuthorizeApiRequest).to receive(:new) do
      double(call: { user: OpenStruct.new(id: 1, role: "admin", scheme: "test-scheme") })
    end
  end

  let(:headers) { { "HTTP_AUTHORIZATION" => "Bearer test-token", "HTTP_X_TENANT_SCHEME" => "test-scheme" } }

  describe "GET /api/v1/portfolios/:id/export" do
    it "renders a PDF including the fit/gap report, even with unicode content" do
      get "/api/v1/portfolios/#{portfolio.id}/export?format=pdf&vacancy_id=#{vacancy.id}", headers: headers

      expect(response).to have_http_status(:ok)
      expect(response.content_type).to include("application/pdf")
      expect(response.body.byteslice(0, 5)).to eq("%PDF-")
      expect(response.body.bytesize).to be_positive
    end

    it "renders a portfolio-only PDF when no vacancy is given" do
      get "/api/v1/portfolios/#{portfolio.id}/export?format=pdf", headers: headers

      expect(response).to have_http_status(:ok)
      expect(response.content_type).to include("application/pdf")
      expect(response.body.byteslice(0, 5)).to eq("%PDF-")
    end

    it "exports the portfolio and fit/gap report as JSON" do
      get "/api/v1/portfolios/#{portfolio.id}/export?format=json&vacancy_id=#{vacancy.id}", headers: headers

      expect(response).to have_http_status(:ok)
      expect(response.content_type).to include("application/json")
      expect(json_response_body).to include("exported_at", "portfolio", "fit_gap_report")
    end

    it "rejects unsupported formats" do
      get "/api/v1/portfolios/#{portfolio.id}/export?format=csv", headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "refuses to export a portfolio that is not complete" do
      portfolio.update!(generation_status: "generating")
      get "/api/v1/portfolios/#{portfolio.id}/export?format=pdf", headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_response_body.dig("errors", 0, "message")).to include("not ready for export")
    end
  end
end