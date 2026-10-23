# frozen_string_literal: true

require 'rails_helper'

RSpec.describe "Api::V1::FitGapAndExports", type: :request do
  let!(:org) do
    Organization.find_by(scheme: 'test-corp') || Organization.create!(
      name: 'Test Corp', scheme: 'test-corp', identifier: 'test-corp-id', host: 'localhost'
    )
  end
  let!(:user) { User.create!(email: "assessor_fg_req@test.com", password_digest: BCrypt::Password.create("secret123"), role: "admin") }
  let!(:assessment) do
    a = Assessment.create!(name: "DevOps Specialist", tenant_id: org.id, created_by: user.id, time_limit_min: 30)
    a.assessment_skills.create!(skill_id: "sk-01", skill_label: "Terraform", l1_anchor: "L1", l2_anchor: "L2", l3_anchor: "L3", l4_anchor: "L4", l5_anchor: "L5")
    a
  end
  let!(:session) { Session.create!(assessment: assessment, tenant_id: org.id, status: 'ended') }
  let!(:portfolio) do
    p = session.create_portfolio!(generation_status: 'complete')
    p.portfolio_skills.create!(skill_id: "sk-01", skill_label: "Terraform", ai_level: 4, ai_confidence: "high", competency_summary: "IaC master.")
    p
  end
  let!(:vacancy) do
    v = Vacancy.create!(role_title: "Cloud Engineer", tenant_id: org.id, created_by: user.id)
    v.vacancy_skills.create!(skill_id: "sk-01", skill_label: "Terraform", expected_level: 3)
    v
  end
  let(:headers) { authenticated_headers('admin', org) }

  before do
    allow(FitGapGeneratorWorker).to receive(:perform_async)
  end

  describe "POST /api/v1/portfolios/:id/fitgap" do
    it "enqueues fit gap report generation when report does not exist yet" do
      post "/api/v1/portfolios/#{portfolio.id}/fitgap",
           params: { fitgap: { vacancy_id: vacancy.id } }.to_json,
           headers: headers

      expect(response).to have_http_status(:accepted)
      json = JSON.parse(response.body)
      expect(json["status"]).to eq("generating")
      expect(FitGapGeneratorWorker).to have_received(:perform_async).with(portfolio.id, vacancy.id).once
    end
  end

  describe "GET /api/v1/portfolios/:id/export" do
    it "exports portfolio as JSON" do
      get "/api/v1/portfolios/#{portfolio.id}/export?format=json", headers: headers

      expect(response).to have_http_status(:ok)
      expect(response.headers['Content-Type']).to include('application/json')
    end

    it "exports portfolio as PDF" do
      get "/api/v1/portfolios/#{portfolio.id}/export?format=pdf", headers: headers

      expect(response).to have_http_status(:ok)
      expect(response.headers['Content-Type']).to include('application/pdf')
      expect(response.body.start_with?("%PDF-")).to be true
    end
  end
end
