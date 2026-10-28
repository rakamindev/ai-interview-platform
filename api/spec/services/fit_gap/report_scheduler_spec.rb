# frozen_string_literal: true

require "rails_helper"

RSpec.describe FitGap::ReportScheduler do
  before { Current.clear }

  def create_inputs(scheme: "scheduler-test")
    organization = Organization.create!(
      name: scheme, scheme: scheme, identifier: scheme,
      host: "#{scheme}.example.test", alias_hosts: [], config: {}
    )
    assessment = Assessment.create!(
      tenant_id: organization.id, created_by: 9002, name: "Synthetic assessment",
      time_limit_min: 30, language: "en"
    )
    session = Session.create!(tenant_id: organization.id, assessment: assessment, status: "ended")
    portfolio = Portfolio.create!(session: session, generation_status: "complete")
    vacancy = Vacancy.create!(tenant_id: organization.id, created_by: 9002, role_title: "Engineer")
    [portfolio, vacancy]
  end

  it "enqueues only once while an equivalent report is queued" do
    portfolio, vacancy = create_inputs
    allow(FitGapGeneratorWorker).to receive(:perform_async).and_return("synthetic-job-id")

    first = described_class.enqueue(portfolio: portfolio, vacancy: vacancy)
    second = described_class.enqueue(portfolio: portfolio, vacancy: vacancy)

    expect(first.generation_status).to eq("queued")
    expect(second.generation_status).to eq("queued")
    expect(FitGapGeneratorWorker).to have_received(:perform_async).once
  end

  it "preserves the last saved comparison while a refresh is queued" do
    portfolio, vacancy = create_inputs(scheme: "preserve-report-test")
    allow(FitGapGeneratorWorker).to receive(:perform_async).and_return("synthetic-job-id")
    report = described_class.enqueue(portfolio: portfolio, vacancy: vacancy)
    report.update!(generation_status: "complete", generated_at: Time.current,
                   skill_comparisons: [{ "result" => "match" }])

    refreshed = described_class.enqueue(portfolio: portfolio, vacancy: vacancy, force: true)

    expect(refreshed.generation_status).to eq("queued")
    expect(refreshed.skill_comparisons).to eq([{ "result" => "match" }])
    expect(refreshed.generated_at).not_to be_nil
    expect(FitGapGeneratorWorker).to have_received(:perform_async).twice
  end

  it "refreshes the report when the vacancy requirements change" do
    portfolio, vacancy = create_inputs(scheme: "input-change-test")
    vacancy.vacancy_skills.create!(skill_label: "Ruby", expected_level: 2)
    allow(FitGapGeneratorWorker).to receive(:perform_async).and_return("synthetic-job-id")
    report = described_class.enqueue(portfolio: portfolio, vacancy: vacancy)
    report.update!(generation_status: "complete", generated_at: Time.current)

    vacancy.vacancy_skills.first.update!(expected_level: 4)
    refreshed = described_class.enqueue(portfolio: portfolio, vacancy: vacancy)

    expect(refreshed.generation_status).to eq("queued")
    expect(FitGapGeneratorWorker).to have_received(:perform_async).twice
  end

  it "marks the report failed when the job queue refuses the job" do
    portfolio, vacancy = create_inputs(scheme: "queue-failure-test")
    allow(FitGapGeneratorWorker).to receive(:perform_async).and_return(nil)

    report = described_class.enqueue(portfolio: portfolio, vacancy: vacancy)

    expect(report.generation_status).to eq("failed")
    expect(report.generation_error).to be_present
  end

  it "refuses to schedule a cross-tenant comparison" do
    portfolio, = create_inputs(scheme: "tenant-a-scheduler-test")
    _, foreign_vacancy = create_inputs(scheme: "tenant-b-scheduler-test")
    allow(FitGapGeneratorWorker).to receive(:perform_async)

    expect(described_class.enqueue(portfolio: portfolio, vacancy: foreign_vacancy)).to be_nil
    expect(FitGapGeneratorWorker).not_to have_received(:perform_async)
  end
end
