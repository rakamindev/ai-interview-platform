# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Portfolio skill override", type: :request do
  let(:portfolio) { create(:portfolio) }
  let(:skill)     { create(:portfolio_skill, portfolio:, ai_level: 3) }
  let(:vacancy)   { create(:vacancy) }

  before do
    create(:fit_gap_report, portfolio:, vacancy:)
    allow(FitGapGeneratorWorker).to receive(:perform_async)
  end

  it "enqueues regeneration and keeps the existing report" do
    post "/api/v1/portfolio_skills/#{skill.id}/override",
         params: { override: { override_level: 5, assessor_notes: "reviewed" } },
         headers: auth_headers

    expect(response).to have_http_status(:created)
    expect(FitGapGeneratorWorker).to have_received(:perform_async).with(portfolio.id, vacancy.id)
    expect(FitGapReport.find_by(portfolio_id: portfolio.id, vacancy_id: vacancy.id)).to be_present
  end
end
