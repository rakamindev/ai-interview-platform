# frozen_string_literal: true

require "rails_helper"
require_relative "../../../app/services/fit_gap/report_coordinator"

RSpec.describe FitGap::ReportCoordinator do
  def create_tenant(prefix)
    Organization.create!(
      name: "#{prefix} Organization",
      scheme: "#{prefix.downcase}-#{SecureRandom.hex(4)}",
      identifier: "#{prefix.downcase}-#{SecureRandom.hex(4)}",
      host: "#{prefix.downcase}-#{SecureRandom.hex(4)}.test"
    )
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
    portfolio = Portfolio.create!(session: session, generation_status: "complete")
    portfolio.portfolio_skills.create!(
      skill_id: "react",
      skill_label: "React",
      is_discovered: false,
      ai_level: 2,
      ai_confidence: "high",
      evidence: ["Candidate example"],
      competency_summary: "Demonstrated skill."
    )
    portfolio
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

  it "rejects a Portfolio and Vacancy from different tenants" do
    portfolio = double(
      "Portfolio",
      id: 10,
      session: double("Session", tenant_id: 1)
    )
    vacancy = double("Vacancy", id: 20, tenant_id: 2)

    expect {
      described_class.new(
        portfolio: portfolio,
        vacancy: vacancy,
        enqueue: false
      ).call
    }.to raise_error(ActiveRecord::RecordNotFound, "Fit/gap report not found")
  end

  it "persists the deterministic comparison and schedules narrative work" do
    tenant = create_tenant("Coordinator")
    portfolio = create_portfolio(tenant)
    vacancy = create_vacancy(tenant)
    allow(FitGapGeneratorWorker).to receive(:perform_async)

    report = described_class.new(
      portfolio: portfolio,
      vacancy: vacancy
    ).call

    expect(report.narrative_status).to eq("pending")
    expect(report.narrative_error).to be_nil
    expect(report.narrative_generation).to eq(1)
    expect(report.skill_comparisons.first).to include(
      "skill_label" => "React",
      "candidate_level" => 2,
      "expected_level" => 3,
      "result" => "gap",
      "delta" => -1
    )
    expect(FitGapGeneratorWorker).to have_received(:perform_async).with(report.id, 1)
  end

  it "keeps one report per portfolio-vacancy pair and bumps generation on each run" do
    tenant = create_tenant("UniquePair")
    portfolio = create_portfolio(tenant)
    vacancy = create_vacancy(tenant)
    allow(FitGapGeneratorWorker).to receive(:perform_async)

    2.times do
      described_class.new(
        portfolio: portfolio,
        vacancy: vacancy
      ).call
    end

    reports = FitGapReport.where(portfolio_id: portfolio.id, vacancy_id: vacancy.id)
    expect(reports.count).to eq(1)
    expect(reports.first.narrative_generation).to eq(2)
    expect(FitGapGeneratorWorker).to have_received(:perform_async).twice
  end

  it "does not enqueue narrative work when enqueue is false" do
    tenant = create_tenant("NoEnqueue")
    portfolio = create_portfolio(tenant)
    vacancy = create_vacancy(tenant)

    expect(FitGapGeneratorWorker).not_to receive(:perform_async)

    report = described_class.new(
      portfolio: portfolio,
      vacancy: vacancy,
      enqueue: false
    ).call

    expect(report.narrative_status).to eq("pending")
  end
end
