# frozen_string_literal: true

require "rails_helper"

RSpec.describe FitGap::Engine do
  let(:organization) { create(:organization) }
  let(:assessment) { create(:assessment, organization: organization) }
  let(:session) { create(:session, assessment: assessment) }
  let(:portfolio) { create(:portfolio, session: session) }
  let(:vacancy) { create(:vacancy, organization: organization) }

  def fake_narrative_client
    instance_double(
      Gemini::HttpClient,
      generate_content: { "culture_narrative" => "ok", "overall_narrative" => "ok" }
    )
  end

  # This is the exact crash scenario introduced by making every configured
  # skill always produce a portfolio_skill row (assessment/gap-analysis.md
  # P0-4): a not_assessed row now gets FOUND by find_portfolio_skill instead
  # of being absent, so the engine must not assume "found" implies "has a
  # level".
  it "reports not_assessed instead of crashing when the matched skill has no level" do
    create(:vacancy_skill, vacancy: vacancy, skill_id: "sk-comm", skill_label: "Communication", expected_level: 3)
    create(:portfolio_skill, :not_assessed, portfolio: portfolio, skill_id: "sk-comm", skill_label: "Communication")

    engine = described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: fake_narrative_client)

    report = nil
    expect { report = engine.call }.not_to raise_error

    comparison = report.skill_comparisons.find { |c| c["skill_label"] == "Communication" }
    expect(comparison["result"]).to eq("not_assessed")
    expect(comparison["candidate_level"]).to be_nil
    expect(comparison["delta"]).to be_nil
  end

  it "still computes a real match/gap/exceed result for an assessed skill" do
    create(:vacancy_skill, vacancy: vacancy, skill_id: "sk-react", skill_label: "React", expected_level: 3)
    create(:portfolio_skill, portfolio: portfolio, skill_id: "sk-react", skill_label: "React", ai_level: 4)

    report = described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: fake_narrative_client).call

    comparison = report.skill_comparisons.find { |c| c["skill_label"] == "React" }
    expect(comparison["result"]).to eq("exceed")
    expect(comparison["delta"]).to eq(1)
  end
end
