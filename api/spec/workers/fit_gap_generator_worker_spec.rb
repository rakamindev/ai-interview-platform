# frozen_string_literal: true

require "rails_helper"

RSpec.describe FitGapGeneratorWorker do
  let(:organization) { create(:organization) }
  let(:session) { create(:session, assessment: create(:assessment, organization: organization)) }
  let(:portfolio) { create(:portfolio, session: session) }
  let(:vacancy) { create(:vacancy, organization: organization) }

  def exhaust(error_message = "boom key=SECRET123")
    msg = { "args" => [portfolio.id, vacancy.id], "retry_count" => 2, "error_message" => error_message }
    described_class.sidekiq_retries_exhausted_block.call(msg, StandardError.new(error_message))
  end

  it "marks the report failed once retries run out, so the UI stops polling forever" do
    exhaust

    report = FitGapReport.find_by!(portfolio_id: portfolio.id, vacancy_id: vacancy.id)
    expect(report.status).to eq("failed")
    expect(report.error).not_to include("SECRET123")
  end

  it "lets a later successful run overwrite the failed placeholder" do
    exhaust
    client = instance_double(Gemini::HttpClient, generate_content: { "culture_narrative" => "c", "overall_narrative" => "o" })

    report = FitGap::Engine.new(portfolio: portfolio, vacancy: vacancy, gemini_client: client).call

    expect(report.status).to eq("complete")
    expect(report.error).to be_nil
  end
end
