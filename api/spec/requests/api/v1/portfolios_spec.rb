# frozen_string_literal: true

require 'rails_helper'

RSpec.describe "Api::V1::Portfolios", type: :request do
  let(:org) { create_organization }
  let(:user) { create_user(org) }
  let(:headers) { auth_headers(org, user) }

  let(:assessment) do
    Assessment.create!(
      tenant_id: org.id,
      name: "Engineering Assessment",
      time_limit_min: 45,
      created_by: user.id
    )
  end
  let(:session_record) do
    Session.create!(
      tenant_id: org.id,
      assessment: assessment,
      status: 'ended'
    )
  end
  let(:portfolio) do
    Portfolio.create!(
      session: session_record,
      generation_status: 'complete',
      generated_at: Time.current
    )
  end
  let(:vacancy) do
    Vacancy.create!(
      tenant_id: org.id,
      role_title: "Lead Architect",
      created_by: user.id
    )
  end

  describe "GET /api/v1/portfolios/:id/fitgap/:vacancy_id" do
    it "returns 404 when report does not exist and is not in progress" do
      get "/api/v1/portfolios/#{portfolio.id}/fitgap/#{vacancy.id}", headers: headers

      expect(response).to have_http_status(:not_found)
    end

    it "returns 202 accepted with generating status when report generation is in progress" do
      allow(FitGapGeneratorWorker).to receive(:in_progress?).with(portfolio.id, vacancy.id.to_s).and_return(true)

      get "/api/v1/portfolios/#{portfolio.id}/fitgap/#{vacancy.id}", headers: headers

      expect(response).to have_http_status(:accepted)
      json = JSON.parse(response.body)
      expect(json['status']).to eq('generating')
    end

    it "returns 200 with report payload when report is present" do
      report = FitGapReport.create!(
        portfolio: portfolio,
        vacancy: vacancy,
        skill_comparisons: [
          { "skill_label" => "Architecture", "expected_level" => 4, "required_level" => 4, "candidate_level" => 4, "result" => "match" }
        ],
        culture_narrative: "Strong cultural alignment.",
        overall_narrative: "Recommended."
      )

      get "/api/v1/portfolios/#{portfolio.id}/fitgap/#{vacancy.id}", headers: headers

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json['report']['id']).to eq(report.id)
      expect(json['report']['skill_comparisons'].first['result']).to eq('match')
    end
  end

  describe "POST /api/v1/portfolios/:id/fitgap" do
    it "does not queue duplicate background jobs if already in progress" do
      allow(FitGapGeneratorWorker).to receive(:in_progress?).with(portfolio.id, vacancy.id).and_return(true)
      expect(FitGapGeneratorWorker).not_to receive(:perform_async)

      post "/api/v1/portfolios/#{portfolio.id}/fitgap",
           params: { vacancy_id: vacancy.id }.to_json,
           headers: headers

      expect(response).to have_http_status(:accepted)
      json = JSON.parse(response.body)
      expect(json['status']).to eq('generating')
    end

    it "queues background job and marks in progress when not yet generated" do
      allow(FitGapGeneratorWorker).to receive(:in_progress?).and_return(false)
      expect(FitGapGeneratorWorker).to receive(:set_in_progress!).with(portfolio.id, vacancy.id)
      expect(FitGapGeneratorWorker).to receive(:perform_async).with(portfolio.id, vacancy.id)

      post "/api/v1/portfolios/#{portfolio.id}/fitgap",
           params: { vacancy_id: vacancy.id }.to_json,
           headers: headers

      expect(response).to have_http_status(:accepted)
    end
  end
end
