# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Portfolio skills overrides", type: :request do
  let(:org) { create(:organization) }
  let(:user) { create(:user, role: "admin") }
  let(:headers) { jwt_for(user: user, scheme: org.scheme) }

  let(:assessment) { create(:assessment, tenant_id: org.id) }
  let(:session) { create(:session, assessment: assessment, tenant_id: org.id) }
  let(:portfolio) { create(:portfolio, session: session, tenant_id: org.id) }
  let(:portfolio_skill) do
    create(:portfolio_skill, portfolio: portfolio, tenant_id: org.id, ai_level: 3)
  end

  let(:override_url) { "/api/v1/portfolio-skills/#{portfolio_skill.id}/override" }
  let(:valid_params) { { override: { override_level: 4, assessor_notes: "Strong signal" } } }

  describe "AC-3.1: valid override with a reason" do
    it "creates an override and writes an audit event" do
      post override_url, params: valid_params, headers: headers

      expect(response).to have_http_status(:created)
      body = response.parsed_body
      expect(body["override"]["override_level"]).to eq(4)

      event = AssessorOverrideEvent.last
      expect(event.portfolio_skill_id).to eq(portfolio_skill.id)
      expect(event.override_level).to eq(4)
      expect(event.assessor_notes).to eq("Strong signal")
    end
  end

  describe "AC-3.2: override with no reason" do
    it "returns 422" do
      post override_url,
           params: { override: { override_level: 4 } },
           headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
    end
  end

  describe "AC-3.3: out-of-range override_level" do
    it "returns 422 for level 0" do
      post override_url,
           params: { override: { override_level: 0, assessor_notes: "Bad level" } },
           headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "returns 422 for level 6" do
      post override_url,
           params: { override: { override_level: 6, assessor_notes: "Bad level" } },
           headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
    end
  end

  describe "AC-3.4: string override_level" do
    it "coerces a numeric string to integer" do
      post override_url,
           params: { override: { override_level: "3", assessor_notes: "String level" } },
           headers: headers

      expect(response).to have_http_status(:created)
      body = response.parsed_body
      expect(body["override"]["override_level"]).to eq(3)
    end
  end

  describe "AC-3.5: override equal to AI level" do
    it "permits override_level equal to ai_level" do
      post override_url,
           params: { override: { override_level: 3, assessor_notes: "Confirming AI" } },
           headers: headers

      expect(response).to have_http_status(:created)
    end
  end

  describe "AC-3.6: second override on same skill" do
    it "replaces the current value and preserves history in events" do
      # First override
      post override_url, params: valid_params, headers: headers
      expect(response).to have_http_status(:created)

      # Second override
      post override_url,
           params: { override: { override_level: 2, assessor_notes: "Changed mind" } },
           headers: headers
      expect(response).to have_http_status(:ok)

      body = response.parsed_body
      expect(body["override"]["override_level"]).to eq(2)

      events = AssessorOverrideEvent.where(portfolio_skill_id: portfolio_skill.id)
      expect(events.count).to eq(2)
      expect(events.pluck(:override_level)).to contain_exactly(4, 2)
    end
  end

  describe "AC-3.7: override on another tenant" do
    let(:org_b) { create(:organization, :rival) }
    let(:user_b) { create(:user, role: "admin") }
    let(:assessment_b) { create(:assessment, tenant_id: org_b.id) }
    let(:session_b) { create(:session, assessment: assessment_b, tenant_id: org_b.id) }
    let(:portfolio_b) { create(:portfolio, session: session_b, tenant_id: org_b.id) }
    let(:portfolio_skill_b) do
      create(:portfolio_skill, portfolio: portfolio_b, tenant_id: org_b.id)
    end

    it "returns 404" do
      post "/api/v1/portfolio-skills/#{portfolio_skill_b.id}/override",
           params: valid_params,
           headers: headers

      expect(response).to have_http_status(:not_found)
    end
  end

  describe "AC-3.8: override triggers fit/gap staleness" do
    let(:vacancy) { create(:vacancy, tenant_id: org.id) }
    let!(:fit_gap_report) do
      create(:fit_gap_report, portfolio: portfolio, vacancy: vacancy, tenant_id: org.id)
    end

    it "marks existing reports stale and regenerates once" do
      expect(FitGapGeneratorWorker).to receive(:perform_async).once

      post override_url, params: valid_params, headers: headers

      expect(response).to have_http_status(:created)
    end
  end

  describe "AC-3.9: 5000-character reason" do
    it "accepts a long reason" do
      long_reason = "A" * 5000
      post override_url,
           params: { override: { override_level: 4, assessor_notes: long_reason } },
           headers: headers

      expect(response).to have_http_status(:created)
      body = response.parsed_body
      expect(body["override"]["assessor_notes"]).to eq(long_reason)
    end
  end
end
