# frozen_string_literal: true

require "rails_helper"
require_relative "../../app/workers/fit_gap_generator_worker"

RSpec.describe FitGapGeneratorWorker do
  describe "#perform" do
    it "does not call Gemini when another worker owns the generation" do
      report = double(
        "FitGapReport",
        id: 10,
        narrative_generation: 4,
        portfolio: double("Portfolio", session: double("Session", tenant_id: 1)),
        vacancy: double("Vacancy", tenant_id: 1)
      )
      claim = double("ClaimRelation")

      allow(FitGapReport).to receive(:find).with(10).and_return(report)
      allow(FitGapReport).to receive(:where).and_return(claim)
      allow(claim).to receive(:update_all).and_return(0)

      expect(FitGap::NarrativeGenerator).not_to receive(:new)

      described_class.new.perform(10, 4)
    end

    it "marks a report failed when Portfolio and Vacancy tenants mismatch" do
      report = double(
        "FitGapReport",
        id: 10,
        narrative_generation: 4,
        portfolio: double("Portfolio", session: double("Session", tenant_id: 1)),
        vacancy: double("Vacancy", tenant_id: 2)
      )
      failed = double("FailedRelation")

      allow(FitGapReport).to receive(:find).with(10).and_return(report)
      allow(FitGapReport).to receive(:where).and_return(failed)
      allow(failed).to receive(:update_all) do |attributes|
        expect(attributes).to include(
          narrative_status: "failed",
          narrative_error: "Tenant boundary validation failed"
        )
        1
      end

      expect(FitGap::NarrativeGenerator).not_to receive(:new)

      described_class.new.perform(10, 4)
    end

    it "claims pending work and writes completed narrative" do
      report = double(
        "FitGapReport",
        id: 10,
        narrative_generation: 4,
        narrative_status: "pending",
        skill_comparisons: [],
        portfolio: double("Portfolio", session: double("Session", tenant_id: 1)),
        vacancy: double("Vacancy", tenant_id: 1)
      )
      allow(report).to receive(:reload).and_return(report)
      claim = double("ClaimRelation")
      complete = double("CompleteRelation")
      generator = double("FitGapNarrativeGenerator")

      allow(FitGapReport).to receive(:find).with(10).and_return(report)
      allow(FitGapReport).to receive(:where).and_return(claim, complete)
      allow(claim).to receive(:update_all) do |attributes|
        expect(attributes).not_to have_key(:updated_at)
        1
      end
      allow(complete).to receive(:update_all) do |attributes|
        expect(attributes).not_to have_key(:updated_at)
        1
      end
      allow(FitGap::NarrativeGenerator).to receive(:new).and_return(generator)
      allow(generator).to receive(:generate_narrative!).and_return(
        culture: "Culture narrative",
        overall: "Overall narrative"
      )

      expect(generator).to receive(:generate_narrative!).with([])

      described_class.new.perform(10, 4)
    end

    it "marks claimed work failed without overwriting a newer generation" do
      report = double(
        "FitGapReport",
        id: 10,
        narrative_generation: 4,
        skill_comparisons: [],
        portfolio: double("Portfolio", session: double("Session", tenant_id: 1)),
        vacancy: double("Vacancy", tenant_id: 1)
      )
      allow(report).to receive(:reload).and_return(report)
      claim = double("ClaimRelation")
      failed = double("FailedRelation")
      generator = double("FitGapNarrativeGenerator")

      allow(FitGapReport).to receive(:find).with(10).and_return(report)
      allow(FitGapReport).to receive(:where).and_return(claim, failed)
      allow(claim).to receive(:update_all) do |attributes|
        expect(attributes).not_to have_key(:updated_at)
        1
      end
      allow(failed).to receive(:update_all) do |attributes|
        expect(attributes).not_to have_key(:updated_at)
        0
      end
      allow(FitGap::NarrativeGenerator).to receive(:new).and_return(generator)
      allow(generator).to receive(:generate_narrative!).and_raise(RuntimeError, "narrative timeout")

      expect {
        described_class.new.perform(10, 4)
      }.to raise_error(RuntimeError, "narrative timeout")
    end
  end
end
