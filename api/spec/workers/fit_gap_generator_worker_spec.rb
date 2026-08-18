require_relative "../spec_helper"
require "active_support/all"
require "sidekiq"
require_relative "../../app/workers/fit_gap_generator_worker"

RSpec.describe FitGapGeneratorWorker do
  subject(:worker) { described_class.new }

  describe "generation claims" do
    it "does not enqueue a duplicate while a fresh generation is active" do
      report = instance_double(
        "FitGapReport",
        complete?: false,
        generating?: true,
        generation_started_at: Time.current - 1.minute
      )
      allow(report).to receive(:with_lock).and_yield

      expect(report).not_to receive(:update!)

      expect(worker.send(:claim_report, report)).to be_nil
    end

    it "claims a stale generation with a new token" do
      report = instance_double(
        "FitGapReport",
        complete?: false,
        generating?: true,
        generation_started_at: Time.current - described_class::GENERATION_LOCK_TIMEOUT - 1.second
      )
      allow(report).to receive(:with_lock).and_yield

      expect(report).to receive(:update!).with(
        hash_including(
          generation_status: "generating",
          generation_error: nil,
          generation_started_at: kind_of(Time),
          generation_token: kind_of(String)
        )
      )

      token = worker.send(:claim_report, report)

      expect(token).to be_a(String)
      expect(token).not_to be_empty
    end

    it "does not let an old worker overwrite a newer failure state" do
      report = instance_double("FitGapReport", generation_token: "new-token")
      allow(report).to receive(:with_lock).and_yield

      expect(report).not_to receive(:update)

      worker.send(:fail_report!, report, "old-token")
    end
  end
end
