# frozen_string_literal: true

require "rails_helper"

RSpec.describe FitGapGeneratorWorker do
  it "retries a redelivered job without resetting its active attempt" do
    portfolio = double("portfolio", id: 8, session_id: 3)
    vacancy = double("vacancy", id: 12, tenant_id: 6)
    session = double("session", tenant_id: 6)
    report = double("fit/gap report", generation_status: "generating")
    locked_reports = double("locked reports")
    sessions = double("sessions")

    allow(Portfolio).to receive(:find).with(8).and_return(portfolio)
    allow(Vacancy).to receive(:unscoped).and_return(double(find: vacancy))
    allow(Session).to receive(:unscoped).and_return(sessions)
    allow(sessions).to receive(:find).with(3).and_return(session)
    allow(FitGapReport).to receive(:transaction) { |&block| block.call }
    allow(FitGapReport).to receive(:lock).and_return(locked_reports)
    allow(locked_reports).to receive(:find_by)
      .with(portfolio_id: 8, vacancy_id: 12, generation_token: "attempt-1")
      .and_return(report)

    expect(FitGap::Engine).not_to receive(:new)
    expect(FitGapReport).not_to receive(:where)

    expect do
      described_class.new.perform(8, 12, "attempt-1")
    end.to raise_error(FitGapGeneratorWorker::GenerationInProgress)
  end

  it "does not claim a report superseded by a newer queued attempt" do
    portfolio = double("portfolio", id: 8, session_id: 3)
    vacancy = double("vacancy", id: 12, tenant_id: 6)
    session = double("session", tenant_id: 6)
    sessions = double("sessions")
    locked_reports = double("locked reports")

    allow(Portfolio).to receive(:find).with(8).and_return(portfolio)
    allow(Vacancy).to receive(:unscoped).and_return(double(find: vacancy))
    allow(Session).to receive(:unscoped).and_return(sessions)
    allow(sessions).to receive(:find).with(3).and_return(session)
    allow(FitGapReport).to receive(:transaction) { |&block| block.call }
    allow(FitGapReport).to receive(:lock).and_return(locked_reports)
    expect(locked_reports).to receive(:find_by)
      .with(portfolio_id: 8, vacancy_id: 12, generation_token: "older-attempt")
      .and_return(nil)
    expect(FitGap::Engine).not_to receive(:new)

    described_class.new.perform(8, 12, "older-attempt")
  end

  it "refuses a report job whose portfolio and vacancy belong to different tenants" do
    portfolio = double("portfolio", id: 8, session_id: 3)
    vacancy = double("vacancy", id: 12, tenant_id: 7)
    session = double("session", tenant_id: 6)
    sessions = double("sessions")
    report_scope = double("report scope")

    allow(Portfolio).to receive(:find).with(8).and_return(portfolio)
    allow(Vacancy).to receive(:unscoped).and_return(double(find: vacancy))
    allow(Session).to receive(:unscoped).and_return(sessions)
    allow(sessions).to receive(:find).with(3).and_return(session)
    allow(FitGapReport).to receive(:where).with(
      portfolio_id: 8,
      vacancy_id: 12,
      generation_token: "attempt-1"
    ).and_return(report_scope)
    allow(report_scope).to receive(:where).with(generation_status: "pending").and_return(report_scope)
    expect(report_scope).to receive(:update_all)
      .with(generation_status: "failed", generation_started_at: nil, generation_token: nil)
    expect(FitGap::Engine).not_to receive(:new)

    described_class.new.perform(8, 12, "attempt-1")
  end
end
