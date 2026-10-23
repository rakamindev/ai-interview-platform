# frozen_string_literal: true

require 'rails_helper'

# Portfolios, skills and fit/gap reports carry no tenant_id of their own, so every
# lookup by id must go through the tenant-scoped session. An assessor of one
# organization must not read, export or override another organization's candidate.
RSpec.describe "Tenant isolation for portfolio endpoints", type: :request do
  let!(:own_org) do
    Organization.find_by(scheme: 'test-corp') || Organization.create!(
      name: 'Test Corp', scheme: 'test-corp', identifier: 'test-corp-id', host: 'localhost'
    )
  end
  let!(:other_org) do
    Organization.find_by(scheme: 'other-corp') || Organization.create!(
      name: 'Other Corp', scheme: 'other-corp', identifier: 'other-corp-id', host: 'other.localhost'
    )
  end
  let!(:user) { User.create!(email: "assessor_tenant@test.com", password_digest: BCrypt::Password.create("secret123"), role: "admin") }

  let!(:other_assessment) do
    Assessment.unscoped.create!(name: "Other Org Role", tenant_id: other_org.id, created_by: user.id, time_limit_min: 30)
  end
  let!(:other_session) do
    Session.unscoped.create!(assessment: other_assessment, tenant_id: other_org.id, status: 'ended')
  end
  let!(:other_portfolio) { other_session.create_portfolio!(generation_status: 'complete') }
  let!(:other_skill) do
    other_portfolio.portfolio_skills.create!(
      skill_id: "sk-x", skill_label: "Confidential Skill", ai_level: 3, ai_confidence: "high",
      evidence: ["Private candidate quote."], competency_summary: "Private summary."
    )
  end
  let!(:other_vacancy) do
    v = Vacancy.unscoped.create!(role_title: "Other Role", tenant_id: other_org.id, created_by: user.id)
    v.vacancy_skills.create!(skill_id: "sk-x", skill_label: "Confidential Skill", expected_level: 3)
    v
  end

  let(:own_headers)   { authenticated_headers('admin', own_org) }
  let(:other_headers) { authenticated_headers('admin', other_org) }

  it "returns 404 when exporting another tenant's portfolio, and 200 for its own tenant" do
    get "/api/v1/portfolios/#{other_portfolio.id}/export", headers: own_headers
    expect(response).to have_http_status(:not_found)
    expect(response.body).not_to include("Private candidate quote.")

    get "/api/v1/portfolios/#{other_portfolio.id}/export", headers: other_headers
    expect(response).to have_http_status(:ok)
  end

  it "returns 404 and creates no override for another tenant's portfolio skill" do
    post "/api/v1/portfolio_skills/#{other_skill.id}/override",
         params: { override: { override_level: 1, assessor_notes: "tampered" } }.to_json,
         headers: own_headers

    expect(response).to have_http_status(:not_found)
    expect(AssessorOverride.where(portfolio_skill_id: other_skill.id)).to be_empty
  end

  it "returns 404 for another tenant's fit/gap report and does not destroy it on regenerate" do
    report = FitGapReport.create!(
      portfolio: other_portfolio, vacancy: other_vacancy, generated_at: Time.current,
      skill_comparisons: [{ skill_label: "Confidential Skill", expected_level: 3, candidate_level: 3, result: "match", delta: 0 }]
    )

    get "/api/v1/portfolios/#{other_portfolio.id}/fitgap/#{other_vacancy.id}", headers: own_headers
    expect(response).to have_http_status(:not_found)

    post "/api/v1/portfolios/#{other_portfolio.id}/regenerate_fitgap",
         params: { vacancy_id: other_vacancy.id }.to_json, headers: own_headers
    expect(response).to have_http_status(:not_found)
    expect(FitGapReport.exists?(report.id)).to be true
  end
end
