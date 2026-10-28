# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Portfolio tenant access", type: :request do
  def create_organization(scheme)
    Organization.create!(
      name: scheme, scheme: scheme, identifier: scheme,
      host: "#{scheme}.example.test", alias_hosts: [], config: {}
    )
  end

  def create_portfolio(organization)
    assessment = Assessment.create!(
      tenant_id: organization.id, created_by: 9001, name: "Synthetic assessment",
      time_limit_min: 30, language: "en"
    )
    session = Session.create!(
      tenant_id: organization.id, assessment: assessment,
      candidate_name: "Synthetic candidate", status: "ended"
    )
    portfolio = Portfolio.create!(session: session, generation_status: "complete")
    skill = PortfolioSkill.create!(
      portfolio: portfolio, skill_id: "synthetic-skill", skill_label: "Synthetic skill",
      is_discovered: false, ai_level: 3, ai_confidence: "high",
      evidence: ["Synthetic candidate evidence"], competency_summary: "Synthetic summary"
    )
    [portfolio, skill]
  end

  before do
    Current.clear
    @tenant_a = create_organization("tenant-a-request-spec")
    @tenant_b = create_organization("tenant-b-request-spec")
    @token_a = JsonWebToken.encode(user_id: 9001, role: "admin", scheme: @tenant_a.scheme)
    @portfolio_a, @skill_a = create_portfolio(@tenant_a)
    @portfolio_b, @skill_b = create_portfolio(@tenant_b)
    @vacancy_a = Vacancy.create!(tenant_id: @tenant_a.id, created_by: 9001, role_title: "Synthetic role A")
    @vacancy_b = Vacancy.create!(tenant_id: @tenant_b.id, created_by: 9002, role_title: "Synthetic role B")
    Current.clear
    @headers = { "Authorization" => "Bearer #{@token_a}" }
  end

  it "can read a same-tenant Fit/Gap report (tenant context positive control)" do
    report = FitGapReport.create!(
      portfolio: @portfolio_a, vacancy: @vacancy_a,
      generation_status: "complete", skill_comparisons: [],
      overall_narrative: "Synthetic overall narrative",
      culture_narrative: "Synthetic culture narrative"
    )

    get "/api/v1/portfolios/#{@portfolio_a.id}/fitgap/#{@vacancy_a.id}", headers: @headers

    expect(response).to have_http_status(:ok)
    expect(JSON.parse(response.body).dig("report", "id")).to eq(report.id)
  end

  it "does not expose another tenant's portfolio report" do
    get "/api/v1/portfolios/#{@portfolio_b.id}/fitgap/#{@vacancy_a.id}", headers: @headers

    expect(response).to have_http_status(:not_found)
  end

  it "does not allow an assessor to override another tenant's skill" do
    expect do
      post "/api/v1/portfolio_skills/#{@skill_b.id}/override",
           headers: @headers,
           params: { override: { override_level: 1, assessor_notes: "Synthetic test note" } }
    end.not_to change(AssessorOverride, :count)

    expect(response).to have_http_status(:not_found)
  end

  it "does not allow exporting another tenant's portfolio" do
    get "/api/v1/portfolios/#{@portfolio_b.id}/export", headers: @headers

    expect(response).to have_http_status(:not_found)
  end

  it "schedules a Fit/Gap report for a same-tenant vacancy" do
    expect do
      post "/api/v1/portfolios/#{@portfolio_a.id}/fitgap",
           headers: @headers,
           params: { vacancy_id: @vacancy_a.id }
    end.to change(FitGapReport, :count).by(1)

    expect(response).to have_http_status(:accepted)
  end

  it "does not schedule a fit-gap report using another tenant's vacancy" do
    expect do
      post "/api/v1/portfolios/#{@portfolio_a.id}/fitgap",
           headers: @headers,
           params: { vacancy_id: @vacancy_b.id }
    end.not_to change(FitGapReport, :count)

    expect(response).to have_http_status(:not_found)
  end
end
