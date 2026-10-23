# frozen_string_literal: true

require 'rails_helper'

RSpec.describe "Api::V1::Portfolios", type: :request do
  let!(:org) do
    Organization.find_by(scheme: 'test-corp') || Organization.create!(
      name: 'Test Corp', scheme: 'test-corp', identifier: 'test-corp-id', host: 'localhost'
    )
  end
  let!(:user) { User.create!(email: "assessor_req@test.com", password_digest: BCrypt::Password.create("secret123"), role: "admin") }
  let!(:assessment) do
    a = Assessment.create!(name: "Backend Architect", tenant_id: org.id, created_by: user.id, time_limit_min: 30)
    a.assessment_skills.create!(
      skill_id: "sk-be-001", skill_label: "PostgreSQL Architecture",
      l1_anchor: "L1", l2_anchor: "L2", l3_anchor: "L3", l4_anchor: "L4", l5_anchor: "L5"
    )
    a
  end
  let!(:session) do
    Session.create!(assessment: assessment, tenant_id: org.id, started_at: 10.minutes.ago, status: 'ended')
  end
  let(:headers) { authenticated_headers('admin', org) }

  describe "GET /api/v1/sessions/:id/portfolio" do
    context "when portfolio is generating" do
      let!(:portfolio) { session.create_portfolio!(generation_status: 'generating') }

      it "returns 202 Accepted with generating status" do
        get "/api/v1/sessions/#{session.id}/portfolio", headers: headers

        expect(response).to have_http_status(:accepted)
        json = JSON.parse(response.body)
        expect(json["status"]).to eq("generating")
      end
    end

    context "when portfolio is complete" do
      let!(:portfolio) { session.create_portfolio!(generation_status: 'complete') }
      let!(:skill) do
        portfolio.portfolio_skills.create!(
          skill_id: "sk-be-001",
          skill_label: "PostgreSQL Architecture",
          ai_level: 4,
          ai_confidence: "high",
          evidence: ["Optimized indexed queries."],
          competency_summary: "High capability in query planning."
        )
      end

      it "returns portfolio with structured skills" do
        get "/api/v1/sessions/#{session.id}/portfolio", headers: headers

        expect(response).to have_http_status(:ok)
        json = JSON.parse(response.body)
        expect(json["portfolio"]["generation_status"]).to eq("complete")
        expect(json["portfolio"]["skills"].length).to eq(1)
        expect(json["portfolio"]["skills"][0]["ai_level"]).to eq(4)
      end
    end
  end

  describe "POST /api/v1/portfolio_skills/:id/override" do
    let!(:portfolio) { session.create_portfolio!(generation_status: 'complete') }
    let!(:skill) do
      portfolio.portfolio_skills.create!(
        skill_id: "sk-be-001",
        skill_label: "PostgreSQL Architecture",
        ai_level: 3,
        ai_confidence: "high",
        competency_summary: "Good relational database design."
      )
    end

    it "allows assessor to override skill level with notes" do
      post "/api/v1/portfolio_skills/#{skill.id}/override",
           params: { override: { override_level: 4, assessor_notes: "Stronger system design shown in real-world examples." } }.to_json,
           headers: headers

      expect(response).to have_http_status(:created)
      json = JSON.parse(response.body)
      expect(json["override"]["override_level"]).to eq(4)
      expect(json["override"]["assessor_notes"]).to eq("Stronger system design shown in real-world examples.")
    end
  end
end
