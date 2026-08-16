# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Portfolio authorization", type: :request do
  def create_tenant(prefix)
    Organization.create!(
      name: "#{prefix} Organization",
      scheme: "#{prefix.downcase}-#{SecureRandom.hex(4)}",
      identifier: "#{prefix.downcase}-#{SecureRandom.hex(4)}",
      host: "#{prefix.downcase}-#{SecureRandom.hex(4)}.test"
    )
  end

  def auth_headers(tenant, role: "admin")
    {
      "Authorization" => "Bearer #{JsonWebToken.encode(user_id: 999, role: role, scheme: tenant.scheme)}",
      "X-Tenant-Scheme" => tenant.scheme
    }
  end

  def create_portfolio(tenant)
    assessment = Assessment.create!(
      tenant_id: tenant.id,
      created_by: 999,
      name: "Frontend Assessment",
      time_limit_min: 45,
      language: "en"
    )
    session = Session.create!(tenant_id: tenant.id, assessment: assessment)
    Portfolio.create!(session: session, generation_status: "complete")
  end

  def create_vacancy(tenant)
    vacancy = Vacancy.new(
      tenant_id: tenant.id,
      created_by: 999,
      role_title: "Senior Frontend Engineer"
    )
    vacancy.vacancy_skills.build(
      skill_id: "react",
      skill_label: "React",
      expected_level: 3
    )
    vacancy.save!
    vacancy
  end

  it "returns a same-tenant Fit/Gap report" do
    tenant = create_tenant("SameTenant")
    portfolio = create_portfolio(tenant)
    vacancy = create_vacancy(tenant)
    FitGapReport.create!(
      portfolio: portfolio,
      vacancy: vacancy,
      skill_comparisons: [{ skill_label: "React", result: "not_assessed" }]
    )

    get "/api/v1/portfolios/#{portfolio.id}/fitgap/#{vacancy.id}", headers: auth_headers(tenant)

    expect(response).to have_http_status(:ok)
    expect(JSON.parse(response.body).dig("report", "vacancy_id")).to eq(vacancy.id)
  end

  it "hides a Portfolio and report owned by another tenant" do
    requester_tenant = create_tenant("Requester")
    owner_tenant = create_tenant("Owner")
    portfolio = create_portfolio(owner_tenant)
    vacancy = create_vacancy(owner_tenant)
    FitGapReport.create!(
      portfolio: portfolio,
      vacancy: vacancy,
      skill_comparisons: [{ skill_label: "React", result: "not_assessed" }]
    )

    get "/api/v1/portfolios/#{portfolio.id}/fitgap/#{vacancy.id}", headers: auth_headers(requester_tenant)

    expect(response).to have_http_status(:not_found)
    expect(response.body).not_to include(portfolio.id.to_s)
  end

  it "hides another tenant's PortfolioSkill override endpoint" do
    requester_tenant = create_tenant("OverrideRequester")
    owner_tenant = create_tenant("OverrideOwner")
    portfolio = create_portfolio(owner_tenant)
    portfolio_skill = portfolio.portfolio_skills.create!(
      skill_id: "react",
      skill_label: "React",
      is_discovered: false,
      ai_level: 3,
      ai_confidence: "high",
      evidence: ["Candidate example"],
      competency_summary: "Strong React experience."
    )

    post "/api/v1/portfolio_skills/#{portfolio_skill.id}/override",
         params: { override: { override_level: 2 } },
         headers: auth_headers(requester_tenant)

    expect(response).to have_http_status(:not_found)
  end

  it "requires a bearer token for assessor endpoints" do
    tenant = create_tenant("AuthRequired")

    get "/api/v1/assessments", headers: { "X-Tenant-Scheme" => tenant.scheme }

    expect(response).to have_http_status(:unauthorized)
  end

  it "rejects an authenticated user without assessor role" do
    tenant = create_tenant("RoleRequired")

    get "/api/v1/assessments", headers: auth_headers(tenant, role: "user")

    expect(response).to have_http_status(:forbidden)
  end
end
