# frozen_string_literal: true

require "rails_helper"

RSpec.describe Sessions::EndHandler do
  let(:organization) { create(:organization) }
  let(:assessment) { create(:assessment, organization: organization) }
  let(:session) { create(:session, assessment: assessment, status: "active", started_at: 10.minutes.ago, ended_at: nil, duration_seconds: nil) }

  before { allow_any_instance_of(described_class).to receive(:publish_status_update) }

  it "ends the session, records reason and duration, and creates one pending portfolio" do
    described_class.new(session).call(reason: "manual_candidate")

    session.reload
    expect(session).to be_ended
    expect(session.end_reason).to eq("manual_candidate")
    expect(session.duration_seconds).to be_within(5).of(600)
    expect(session.portfolio.generation_status).to eq("pending")
    expect(PortfolioGeneratorWorker.jobs.size).to eq(1)
  end

  it "falls back to manual_assessor for an unknown reason instead of storing garbage" do
    described_class.new(session).call(reason: "banana")

    expect(session.reload.end_reason).to eq("manual_assessor")
  end

  it "is idempotent: ending an already-ended session does not enqueue a second portfolio job" do
    described_class.new(session).call(reason: "all_covered")
    described_class.new(session.reload).call(reason: "all_covered")

    expect(PortfolioGeneratorWorker.jobs.size).to eq(1)
    expect(Portfolio.where(session_id: session.id).count).to eq(1)
  end

  it "upgrades a spurious 'error' end_reason when the candidate then ends cleanly" do
    described_class.new(session).call(reason: "error")
    described_class.new(session.reload).call(reason: "manual_candidate")

    expect(session.reload.end_reason).to eq("manual_candidate")
  end

  it "does not downgrade a clean end_reason to 'error'" do
    described_class.new(session).call(reason: "manual_candidate")
    described_class.new(session.reload).call(reason: "error")

    expect(session.reload.end_reason).to eq("manual_candidate")
  end

  it "rolls back the status change when portfolio creation fails" do
    allow_any_instance_of(described_class).to receive(:create_portfolio).and_raise(ActiveRecord::RecordInvalid)

    expect { described_class.new(session).call(reason: "manual_assessor") }.to raise_error(ActiveRecord::RecordInvalid)

    expect(session.reload).to be_active
    expect(PortfolioGeneratorWorker.jobs).to be_empty
  end
end
