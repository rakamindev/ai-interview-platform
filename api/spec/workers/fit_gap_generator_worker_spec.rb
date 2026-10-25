# frozen_string_literal: true

require "rails_helper"

RSpec.describe FitGapGeneratorWorker do
  let(:portfolio) { create(:portfolio) }
  let(:vacancy)   { create(:vacancy) }

  it "keeps the existing report intact when generation fails" do
    report = create(:fit_gap_report, portfolio:, vacancy:, source_fingerprint: "old")
    allow(FitGap::Engine).to receive(:new).and_raise(StandardError, "boom")

    expect do
      described_class.new.perform(portfolio.id, vacancy.id)
    end.to raise_error(StandardError, "boom")

    report.reload
    expect(report.source_fingerprint).to eq("old")
    expect(report.skill_comparisons).to be_present
  end
end
