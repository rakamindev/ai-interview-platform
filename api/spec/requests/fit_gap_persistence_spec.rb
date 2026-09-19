# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Fit/gap report persistence (F-1)", type: :request do
  let(:organization) { create(:organization, scheme: "test-scheme") }

  let(:session)  { create(:session, tenant_id: organization.id) }
  let(:portfolio) { create(:portfolio, session: session, generation_status: "complete") }
  let(:vacancy)  { create(:vacancy, tenant_id: organization.id) }

  def stub_fitgap_worker
    allow(FitGapGeneratorWorker).to receive(:perform_async)
  end

  def regenerate_fitgap(vacancy_id)
    authenticated_post "/api/v1/portfolios/#{portfolio.id}/regenerate_fitgap",
                       params: { vacancy_id: vacancy_id }
  end

  describe "POST /api/v1/portfolios/:id/regenerate_fitgap" do
    it "returns 202 accepted with status generating" do
      with_authorized_request do
        stub_fitgap_worker

        regenerate_fitgap(vacancy.id)

        expect(response).to have_http_status(:accepted)
        expect(json_response_body["status"]).to eq("generating")
      end
    end

    it "enqueues FitGapGeneratorWorker with the portfolio id and vacancy id" do
      with_authorized_request do
        stub_fitgap_worker

        regenerate_fitgap(vacancy.id)

        expect(FitGapGeneratorWorker).to have_received(:perform_async).with(portfolio.id, vacancy.id)
      end
    end

    it "keeps an existing FitGapReport intact instead of destroying it" do
      with_authorized_request do
        stub_fitgap_worker
        report = create(:fit_gap_report, portfolio: portfolio, vacancy: vacancy)

        regenerate_fitgap(vacancy.id)

        expect(response).to have_http_status(:accepted)
        expect(FitGapReport.where(portfolio_id: portfolio.id, vacancy_id: vacancy.id).count).to eq(1)
        expect(report.reload.id).to eq(report.id)
      end
    end

    it "returns 422 when vacancy_id is missing" do
      with_authorized_request do
        stub_fitgap_worker

        regenerate_fitgap(nil)

        expect(response).to have_http_status(:unprocessable_entity)
        expect(json_response_body["errors"]).to be_present
      end
    end

    it "returns 404 when the vacancy is not found" do
      with_authorized_request do
        stub_fitgap_worker

        regenerate_fitgap(999_999_999)

        expect(response).to have_http_status(:not_found)
        expect(json_response_body["errors"]).to be_present
      end
    end

    it "returns 422 when the portfolio is not complete" do
      with_authorized_request do
        stub_fitgap_worker
        portfolio.update!(generation_status: "pending")

        regenerate_fitgap(vacancy.id)

        expect(response).to have_http_status(:unprocessable_entity)
        expect(json_response_body["errors"]).to be_present
      end
    end
  end

  describe "regeneration after an assessor override" do
    it "keeps the existing FitGapReport row intact when override enqueues regeneration" do
      with_authorized_request do
        stub_fitgap_worker
        portfolio_skill = create(:portfolio_skill, portfolio: portfolio)
        create(:vacancy_skill,
               vacancy: vacancy,
               skill_id: portfolio_skill.skill_id,
               skill_label: portfolio_skill.skill_label)
        report = create(:fit_gap_report,
                        portfolio: portfolio,
                        vacancy: vacancy,
                        provenance_token: FitGap::Engine.fingerprint(portfolio, vacancy))

        authenticated_post "/api/v1/portfolio_skills/#{portfolio_skill.id}/override",
                           params: { override: { override_level: 5, assessor_notes: "Bumped to 5" } }

        expect(response).to have_http_status(:created)
        expect(FitGapReport.where(portfolio_id: portfolio.id, vacancy_id: vacancy.id).count).to eq(1)
        expect(report.reload.id).to eq(report.id)
        expect(FitGapGeneratorWorker).to have_received(:perform_async).with(portfolio.id, vacancy.id)
      end
    end
  end

  describe "GET /api/v1/portfolios/:id/fitgap/:vacancy_id" do
    it "returns a stale report instead of losing it to a failed regeneration" do
      with_authorized_request do
        stub_fitgap_worker
        create(:fit_gap_report,
               portfolio: portfolio,
               vacancy: vacancy,
               provenance_token: "stale-token")

        authenticated_get "/api/v1/portfolios/#{portfolio.id}/fitgap/#{vacancy.id}"

        expect(response).to have_http_status(:ok)
        expect(json_response_body["report"]).to be_present
        expect(json_response_body.dig("meta", "stale")).to eq(true)
        expect(FitGapGeneratorWorker).to have_received(:perform_async).with(portfolio.id, vacancy.id)
      end
    end
  end
end