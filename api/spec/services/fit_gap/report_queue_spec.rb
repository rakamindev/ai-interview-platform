# frozen_string_literal: true

require "rails_helper"

RSpec.describe FitGap::ReportQueue do
  let(:portfolio) { double("portfolio", id: 8) }
  let(:vacancy) { double("vacancy", id: 12) }

  before do
    allow(portfolio).to receive(:with_lock).and_yield
    allow(SecureRandom).to receive(:uuid).and_return("attempt-token")
  end

  it "creates one pending report and queues a job for the first request" do
    report = double("fit/gap report", generation_status: "pending")
    expect(FitGapReport).to receive(:find_by)
      .with(portfolio_id: 8, vacancy_id: 12)
      .and_return(nil)
    expect(FitGapReport).to receive(:create!)
      .with(
        portfolio_id: 8,
        vacancy_id: 12,
        skill_comparisons: [],
        generated_at: nil,
        generation_started_at: nil,
        generation_token: "attempt-token",
        generation_status: "pending"
      )
      .and_return(report)
    expect(FitGapGeneratorWorker).to receive(:perform_async)
      .with(8, 12, "attempt-token")
      .and_return("job-id")

    result = described_class.new(portfolio: portfolio, vacancy: vacancy).call

    expect(result).to eq(report)
  end

  it "does not enqueue another job while a report is already pending" do
    report = double("fit/gap report", generation_status: "pending")
    expect(FitGapReport).to receive(:find_by)
      .with(portfolio_id: 8, vacancy_id: 12)
      .and_return(report)
    expect(FitGapGeneratorWorker).not_to receive(:perform_async)

    expect(described_class.new(portfolio: portfolio, vacancy: vacancy).call).to eq(report)
  end

  it "requeues pending work only after an explicit retry" do
    report = double("fit/gap report", generation_status: "pending")
    allow(FitGapReport).to receive(:find_by).and_return(report)
    expect(report).to receive(:update!).with(
      generation_status: "pending",
      generation_started_at: nil,
      generation_token: "attempt-token"
    )
    expect(FitGapGeneratorWorker).to receive(:perform_async)
      .with(8, 12, "attempt-token")
      .and_return("retry-job-id")

    described_class.new(portfolio: portfolio, vacancy: vacancy).call(force: true)
  end

  it "supersedes a running report when a human override requires a fresh comparison" do
    report = double("fit/gap report", generation_status: "generating")
    allow(FitGapReport).to receive(:find_by).and_return(report)
    expect(report).to receive(:update!).with(
      generation_status: "pending",
      generation_started_at: nil,
      generation_token: "attempt-token"
    )
    expect(FitGapGeneratorWorker).to receive(:perform_async)
      .with(8, 12, "attempt-token")
      .and_return("replacement-job-id")

    described_class.new(portfolio: portfolio, vacancy: vacancy).call(force: true)
  end

  it "marks a report failed and surfaces queue errors" do
    report = double("fit/gap report", generation_status: "pending")
    allow(FitGapReport).to receive(:find_by).and_return(nil)
    allow(report).to receive(:id).and_return(9)
    allow(FitGapReport).to receive(:create!).and_return(report)
    allow(FitGapGeneratorWorker).to receive(:perform_async).and_return(nil)
    failed_attempt = double("failed attempt scope")
    expect(FitGapReport).to receive(:where)
      .with(id: 9, generation_token: "attempt-token")
      .and_return(failed_attempt)
    expect(failed_attempt).to receive(:where)
      .with(generation_status: "pending")
      .and_return(failed_attempt)
    expect(failed_attempt).to receive(:update_all).with(
      generation_status: "failed",
      generation_started_at: nil,
      generation_token: nil
    )

    expect do
      described_class.new(portfolio: portfolio, vacancy: vacancy).call
    end.to raise_error(RuntimeError, "Fit/gap job could not be queued")
  end
end
