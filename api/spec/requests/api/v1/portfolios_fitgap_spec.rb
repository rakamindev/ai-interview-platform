# frozen_string_literal: true

require "rails_helper"

RSpec.describe "FitGap staleness", type: :request do
  let(:gemini_client) { double("GeminiClient", generate_content: { "culture_narrative" => "c", "overall_narrative" => "o" }) }

  let(:portfolio) do
    create(:portfolio).tap do |p|
      create(:portfolio_skill, portfolio: p, skill_label: "Ruby", ai_level: 3)
    end
  end

  let(:vacancy) do
    create(:vacancy).tap do |v|
      create(:vacancy_skill, vacancy: v, skill_label: "Ruby", expected_level: 3)
    end
  end

  before do
    allow(FitGapGeneratorWorker).to receive(:perform_async)
  end

  def get_fitgap
    get "/api/v1/portfolios/#{portfolio.id}/fitgap/#{vacancy.id}", headers: auth_headers
  end

  def post_fitgap
    post "/api/v1/portfolios/#{portfolio.id}/fitgap",
         params: { vacancy_id: vacancy.id }.to_json,
         headers: auth_headers.merge("Content-Type" => "application/json")
  end

  context "with a fresh report (fingerprint matches current inputs)" do
    before do
      FitGap::Engine.new(portfolio:, vacancy:, gemini_client:).call
    end

    it "returns 200 with the report and source_fingerprint (AC7 fresh path)" do
      get_fitgap
      expect(response.status).to eq(200)
      body = JSON.parse(response.body)
      expect(body.dig("report", "source_fingerprint")).to be_present
      expect(body.dig("report", "skill_comparisons").first).to have_key("expected_level")
    end

    it "returns the cached report on POST without re-enqueuing (AC7)" do
      post_fitgap
      expect(response.status).to eq(200)
      expect(FitGapGeneratorWorker).not_to have_received(:perform_async)
    end
  end

  context "with a stale report (fingerprint no longer matches inputs)" do
    before do
      create(:fit_gap_report, portfolio:, vacancy:, source_fingerprint: "stale")
      # Mutate an input that feeds the fingerprint so it no longer matches "stale".
      portfolio.portfolio_skills.first.update!(ai_level: 5)
    end

    it "returns 202 with the preserved stale report, enqueues regeneration (AC7/AC8)" do
      get_fitgap
      expect(response.status).to eq(202)
      body = JSON.parse(response.body)
      expect(body["status"]).to eq("generating")
      expect(body["stale"]).to be(true)
      expect(body.dig("report", "source_fingerprint")).to eq("stale")
      expect(FitGapGeneratorWorker).to have_received(:perform_async).with(portfolio.id, vacancy.id)
      # Report must not be destroyed before worker finishes
      expect(FitGapReport.find_by(portfolio_id: portfolio.id, vacancy_id: vacancy.id)).to be_present
    end

    it "returns 202 generating on POST, enqueues regeneration, and preserves existing report (AC7)" do
      post_fitgap
      expect(response.status).to eq(202)
      expect(FitGapGeneratorWorker).to have_received(:perform_async).with(portfolio.id, vacancy.id)
      # Report must not be destroyed before worker finishes
      expect(FitGapReport.find_by(portfolio_id: portfolio.id, vacancy_id: vacancy.id)).to be_present
    end

    it "preserves existing report on POST regenerate_fitgap" do
      post "/api/v1/portfolios/#{portfolio.id}/regenerate_fitgap",
           params: { vacancy_id: vacancy.id },
           headers: auth_headers

      expect(response.status).to eq(202)
      expect(FitGapGeneratorWorker).to have_received(:perform_async).with(portfolio.id, vacancy.id)
      expect(FitGapReport.find_by(portfolio_id: portfolio.id, vacancy_id: vacancy.id)).to be_present
    end
  end

  context "with no report" do
    it "returns 404 on GET" do
      get_fitgap
      expect(response.status).to eq(404)
    end

    it "returns 202 generating on POST and enqueues" do
      post_fitgap
      expect(response.status).to eq(202)
      expect(FitGapGeneratorWorker).to have_received(:perform_async)
    end
  end
end
