# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Fit/Gap API contract", type: :request do
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

  def create_portfolio(tenant, skills: [])
    assessment = Assessment.create!(
      tenant_id: tenant.id,
      created_by: 999,
      name: "Frontend Assessment",
      time_limit_min: 45,
      language: "en"
    )
    session = Session.create!(tenant_id: tenant.id, assessment: assessment)
    portfolio = Portfolio.create!(session: session, generation_status: "complete")
    skills.each do |attrs|
      portfolio.portfolio_skills.create!(
        is_discovered: false,
        ai_confidence: "high",
        evidence: ["Candidate example"],
        competency_summary: "Demonstrated skill.",
        **attrs
      )
    end
    portfolio
  end

  def create_vacancy(tenant, skills: [["react", "React", 3]])
    vacancy = Vacancy.new(
      tenant_id: tenant.id,
      created_by: 999,
      role_title: "Senior Frontend Engineer"
    )
    skills.each do |(skill_id, skill_label, expected_level)|
      vacancy.vacancy_skills.build(
        skill_id: skill_id,
        skill_label: skill_label,
        expected_level: expected_level
      )
    end
    vacancy.save!
    vacancy
  end

  it "POST fitgap returns the canonical numeric payload with narrative pending" do
    tenant = create_tenant("Contract")
    portfolio = create_portfolio(
      tenant,
      skills: [
        { skill_id: "react", skill_label: "React", ai_level: 2 }
      ]
    )
    vacancy = create_vacancy(tenant)
    allow(FitGapGeneratorWorker).to receive(:perform_async)

    post "/api/v1/portfolios/#{portfolio.id}/fitgap",
         params: { vacancy_id: vacancy.id },
         headers: auth_headers(tenant)

    expect(response).to have_http_status(:accepted)
    report = JSON.parse(response.body).dig("report")

    expect(report).to include(
      "portfolio_id" => portfolio.id,
      "vacancy_id" => vacancy.id,
      "narrative_status" => "pending",
      "narrative_error" => nil
    )
    expect(report["skill_comparisons"].first).to include(
      "skill_label" => "React",
      "skill_id" => "react",
      "expected_level" => 3,
      "candidate_level" => 2,
      "result" => "gap",
      "delta" => -1,
      "confidence" => "high",
      "is_override" => false,
      "caveat" => nil
    )
    expect(report["summary"]).to include(
      "match_count" => 0,
      "exceed_count" => 0,
      "gap_count" => 1,
      "not_assessed_count" => 0,
      "priority_gaps" => ["React"]
    )
    expect(report["caveats"]).to eq([])
    expect(report["additional_skill_signals"]).to eq([])
    expect(FitGapGeneratorWorker).to have_received(:perform_async).once
  end

  it "POST fitgap is idempotent and returns the cached report" do
    tenant = create_tenant("Idempotent")
    portfolio = create_portfolio(
      tenant,
      skills: [{ skill_id: "react", skill_label: "React", ai_level: 2 }]
    )
    vacancy = create_vacancy(tenant)
    allow(FitGapGeneratorWorker).to receive(:perform_async)

    post "/api/v1/portfolios/#{portfolio.id}/fitgap",
         params: { vacancy_id: vacancy.id },
         headers: auth_headers(tenant)
    first_id = JSON.parse(response.body).dig("report", "id")
    expect(response).to have_http_status(:accepted)

    post "/api/v1/portfolios/#{portfolio.id}/fitgap",
         params: { vacancy_id: vacancy.id },
         headers: auth_headers(tenant)

    expect(response).to have_http_status(:ok)
    expect(JSON.parse(response.body).dig("report", "id")).to eq(first_id)
    expect(FitGapGeneratorWorker).to have_received(:perform_async).once
  end

  it "GET fitgap returns the comparison even while narrative is pending" do
    tenant = create_tenant("PendingGet")
    portfolio = create_portfolio(
      tenant,
      skills: [{ skill_id: "react", skill_label: "React", ai_level: 2 }]
    )
    vacancy = create_vacancy(tenant)
    allow(FitGapGeneratorWorker).to receive(:perform_async)

    post "/api/v1/portfolios/#{portfolio.id}/fitgap",
         params: { vacancy_id: vacancy.id },
         headers: auth_headers(tenant)

    get "/api/v1/portfolios/#{portfolio.id}/fitgap/#{vacancy.id}",
        headers: auth_headers(tenant)

    expect(response).to have_http_status(:ok)
    report = JSON.parse(response.body).dig("report")
    expect(report["narrative_status"]).to eq("pending")
    expect(report["skill_comparisons"].first["result"]).to eq("gap")
  end

  it "reflects an assessor override in the comparison payload" do
    tenant = create_tenant("Override")
    portfolio = create_portfolio(
      tenant,
      skills: [{ skill_id: "react", skill_label: "React", ai_level: 3 }]
    )
    skill = portfolio.portfolio_skills.first
    skill.build_assessor_override(
      ai_level: 3,
      override_level: 2,
      assessor_notes: "Evidence shows early-stage only.",
      overridden_by: 999,
      overridden_at: Time.current
    ).save!
    vacancy = create_vacancy(tenant)
    allow(FitGapGeneratorWorker).to receive(:perform_async)

    post "/api/v1/portfolios/#{portfolio.id}/fitgap",
         params: { vacancy_id: vacancy.id },
         headers: auth_headers(tenant)

    comparison = JSON.parse(response.body).dig("report", "skill_comparisons").first
    expect(comparison).to include(
      "candidate_level" => 2,
      "expected_level" => 3,
      "result" => "gap",
      "delta" => -1,
      "is_override" => true
    )
  end

  it "rejects a Vacancy from another tenant without enumerating it" do
    requester = create_tenant("ReqVacancy")
    owner = create_tenant("OwnerVacancy")
    portfolio = create_portfolio(
      requester,
      skills: [{ skill_id: "react", skill_label: "React", ai_level: 2 }]
    )
    vacancy = create_vacancy(owner)

    post "/api/v1/portfolios/#{portfolio.id}/fitgap",
         params: { vacancy_id: vacancy.id },
         headers: auth_headers(requester)

    expect(response).to have_http_status(:not_found)
    expect(response.body).not_to include(vacancy.id.to_s)
    expect(response.body).to include("Vacancy not found")
  end
end
