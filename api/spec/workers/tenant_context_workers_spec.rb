require_relative "../rails_helper"

RSpec.describe "tenant-aware workers" do
  it "skips system prompt jobs without a tenant" do
    expect(Assessment).not_to receive(:find)

    SystemPromptGeneratorWorker.new.perform("assessment-id")
  end

  it "skips portfolio jobs without a tenant" do
    expect(Session).not_to receive(:find)

    PortfolioGeneratorWorker.new.perform("session-id")
  end

  it "skips coverage jobs without a tenant" do
    expect(Session).not_to receive(:find)

    CoverageAnalyzerWorker.new.perform("session-id", 1)
  end

  it "skips fit-gap jobs without a tenant" do
    expect(Portfolio).not_to receive(:joins)

    FitGapGeneratorWorker.new.perform("portfolio-id", "vacancy-id")
  end
end