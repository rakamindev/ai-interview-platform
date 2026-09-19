# frozen_string_literal: true

require "rails_helper"

RSpec.describe "FitGap staleness detection", type: :request do
  let(:organization) { create(:organization, scheme: "test-scheme") }
  let(:tenant_id) { organization.id }

  let(:assessment) { create(:assessment, tenant_id: tenant_id) }
  let(:session) { create(:session, tenant_id: tenant_id, assessment: assessment) }
  let(:portfolio) { create(:portfolio, session: session, generation_status: "complete") }
  let(:vacancy) { create(:vacancy, tenant_id: tenant_id) }
  let(:vacancy_skill) { create(:vacancy_skill, vacancy: vacancy) }
  let(:portfolio_skill) { create(:portfolio_skill, portfolio: portfolio) }

  let(:fresh_report) do
    # Force skill rows to exist BEFORE the fingerprint is computed. Otherwise the
    # lazily-fetched `vacancy_skill`/`portfolio_skill` would only be created after
    # the report, making the freshness comparison vacuous (and every staleness
    # trigger below would "pass" without proving anything).
    vacancy_skill
    portfolio_skill
    create(
      :fit_gap_report,
      portfolio: portfolio,
      vacancy: vacancy,
      provenance_token: FitGap::Engine.fingerprint(portfolio, vacancy)
    )
  end

  before { allow(FitGapGeneratorWorker).to receive(:perform_async) }

  describe "GET /api/v1/portfolios/:id/fitgap/:vacancy_id" do
    it "returns the report with meta.stale false when provenance matches the fingerprint" do
      with_authorized_request do
        fresh_report
        authenticated_get "/api/v1/portfolios/#{portfolio.id}/fitgap/#{vacancy.id}"

        expect(response).to have_http_status(:ok)
        expect(json_response_body.dig("report", "skill_comparisons")).to be_present
        expect(json_response_body.dig("meta", "stale")).to eq(false)
      end
    end

    it "does not enqueue regeneration when the report is not stale" do
      with_authorized_request do
        fresh_report
        authenticated_get "/api/v1/portfolios/#{portfolio.id}/fitgap/#{vacancy.id}"

        expect(json_response_body.dig("meta", "stale")).to eq(false)
        expect(FitGapGeneratorWorker).not_to have_received(:perform_async)
      end
    end

    it "returns meta.stale true when the vacancy expected_level changes after the report was generated" do
      with_authorized_request do
        fresh_report
        vacancy_skill.update!(expected_level: 4)
        authenticated_get "/api/v1/portfolios/#{portfolio.id}/fitgap/#{vacancy.id}"

        expect(response).to have_http_status(:ok)
        expect(json_response_body.dig("meta", "stale")).to eq(true)
        expect(FitGapGeneratorWorker).to have_received(:perform_async).with(portfolio.id, vacancy.id)
      end
    end

    it "returns meta.stale true when an assessor override is added to a portfolio skill" do
      with_authorized_request do
        fresh_report
        create(:assessor_override, portfolio_skill: portfolio_skill, override_level: 5)
        authenticated_get "/api/v1/portfolios/#{portfolio.id}/fitgap/#{vacancy.id}"

        expect(response).to have_http_status(:ok)
        expect(json_response_body.dig("meta", "stale")).to eq(true)
        expect(FitGapGeneratorWorker).to have_received(:perform_async).with(portfolio.id, vacancy.id)
      end
    end

    it "enqueues FitGapGeneratorWorker.perform_async exactly once when stale" do
      with_authorized_request do
        fresh_report
        vacancy_skill.update!(expected_level: 4)
        authenticated_get "/api/v1/portfolios/#{portfolio.id}/fitgap/#{vacancy.id}"

        expect(FitGapGeneratorWorker).to have_received(:perform_async).with(portfolio.id, vacancy.id).once
      end
    end

    it "returns 404 when no report exists for the portfolio/vacancy pair" do
      with_authorized_request do
        authenticated_get "/api/v1/portfolios/#{portfolio.id}/fitgap/#{vacancy.id}"

        expect(response).to have_http_status(:not_found)
        expect(json_response_body.dig("errors", 0, "message")).to eq("Fit/gap report not found")
      end
    end

    it "returns 404 when the portfolio is not found" do
      with_authorized_request do
        authenticated_get "/api/v1/portfolios/999999/fitgap/#{vacancy.id}"

        expect(response).to have_http_status(:not_found)
        expect(json_response_body.dig("errors", 0, "message")).to eq("Portfolio not found")
      end
    end

    it "returns success with nil culture/overall narrative when the report has only skill_comparisons" do
      with_authorized_request do
        create(
          :fit_gap_report,
          portfolio: portfolio,
          vacancy: vacancy,
          culture_narrative: nil,
          overall_narrative: nil,
          provenance_token: FitGap::Engine.fingerprint(portfolio, vacancy)
        )
        authenticated_get "/api/v1/portfolios/#{portfolio.id}/fitgap/#{vacancy.id}"

        expect(response).to have_http_status(:ok)
        expect(json_response_body.dig("report", "culture_narrative")).to be_nil
        expect(json_response_body.dig("report", "overall_narrative")).to be_nil
      end
    end
  end

  describe "POST /api/v1/portfolios/:id/fitgap" do
    it "returns stale false and does not enqueue when an existing report is fresh" do
      with_authorized_request do
        fresh_report
        authenticated_post "/api/v1/portfolios/#{portfolio.id}/fitgap",
                           params: { fitgap: { vacancy_id: vacancy.id } }

        expect(response).to have_http_status(:ok)
        expect(json_response_body.dig("meta", "stale")).to eq(false)
        expect(FitGapGeneratorWorker).not_to have_received(:perform_async)
      end
    end

    it "returns stale true and enqueues regeneration when an existing report is stale" do
      with_authorized_request do
        fresh_report
        vacancy_skill.update!(expected_level: 4)
        authenticated_post "/api/v1/portfolios/#{portfolio.id}/fitgap",
                           params: { fitgap: { vacancy_id: vacancy.id } }

        expect(response).to have_http_status(:ok)
        expect(json_response_body.dig("meta", "stale")).to eq(true)
        expect(FitGapGeneratorWorker).to have_received(:perform_async).with(portfolio.id, vacancy.id)
      end
    end

    it "returns 202 with status generating and enqueues when no report exists" do
      with_authorized_request do
        authenticated_post "/api/v1/portfolios/#{portfolio.id}/fitgap",
                           params: { fitgap: { vacancy_id: vacancy.id } }

        expect(response).to have_http_status(:accepted)
        expect(json_response_body["status"]).to eq("generating")
        expect(FitGapGeneratorWorker).to have_received(:perform_async).with(portfolio.id, vacancy.id)
      end
    end
  end
end