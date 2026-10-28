# frozen_string_literal: true

require "rails_helper"

RSpec.describe FitGap::Engine do
  let(:skill_association) { double("portfolio skills association") }
  let(:portfolio) { double("portfolio", id: 10, session: double("session", tenant_id: 1), portfolio_skills: skill_association) }
  let(:vacancy_relation) { double("vacancy skills relation") }
  let(:vacancy) do
    double("vacancy", id: 20, tenant_id: 1, vacancy_skills: vacancy_relation,
           role_title: "Engineer", culture_dimensions: nil, competency_expectations: nil)
  end
  let(:gemini) { double("Gemini client", generate_content: { "culture_narrative" => "Evidence context", "overall_narrative" => "Neutral summary" }) }

  def portfolio_skill(skill_id:, label:, level:, evidence: ["Candidate described the exact trade-off."], confidence: "high", override: nil)
    double("portfolio skill", id: skill_id, skill_id: skill_id, skill_label: label,
           ai_level: level, ai_confidence: confidence, evidence_quotes: evidence,
           assessor_override: override)
  end

  def vacancy_skill(skill_id:, label:, level:)
    double("vacancy skill", skill_id: skill_id, skill_label: label, expected_level: level)
  end

  def comparisons(rows, requirements)
    allow(skill_association).to receive(:includes).with(:assessor_override).and_return(rows)
    allow(vacancy_relation).to receive(:order).with(:id).and_return(requirements)
    described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: gemini)
      .send(:build_skill_comparisons)
  end

  it "keeps distinct requirements even when labels are identical" do
    result = comparisons(
      [
        portfolio_skill(skill_id: "skill-a", label: "Shared skill", level: 4),
        portfolio_skill(skill_id: "skill-b", label: "Shared skill", level: 2)
      ],
      [
        vacancy_skill(skill_id: "skill-a", label: "Shared skill", level: 3),
        vacancy_skill(skill_id: "skill-b", label: "Shared skill", level: 4)
      ]
    )

    expect(result.length).to eq(2)
    expect(result.map { |row| row[:result] }).to eq(%w[exceed gap])
    expect(result.map { |row| row[:required_level] }).to eq([3, 4])
  end

  it "does not match a different stable skill ID just because its label is the same" do
    result = comparisons(
      [portfolio_skill(skill_id: "skill-a", label: "Shared skill", level: 5)],
      [vacancy_skill(skill_id: "skill-b", label: "Shared skill", level: 3)]
    ).first

    expect(result[:result]).to eq("not_assessed")
    expect(result[:candidate_level]).to be_nil
    expect(result[:delta]).to be_nil
  end

  it "treats a rating without candidate-authored evidence as not assessed" do
    result = comparisons(
      [portfolio_skill(skill_id: "skill-a", label: "Ruby", level: 4, evidence: [])],
      [vacancy_skill(skill_id: "skill-a", label: "Ruby", level: 2)]
    ).first

    expect(result[:result]).to eq("not_assessed")
    expect(result[:candidate_level]).to be_nil
  end

  it "uses the human override and returns the explicit override marker" do
    override = double("assessor override", override_level: 2)
    result = comparisons(
      [portfolio_skill(skill_id: "skill-a", label: "Ruby", level: 5, override: override)],
      [vacancy_skill(skill_id: "skill-a", label: "Ruby", level: 3)]
    ).first

    expect(result[:candidate_level]).to eq(2)
    expect(result[:result]).to eq("gap")
    expect(result[:is_override]).to be(true)
  end

  it "does not arbitrarily choose between ambiguous label-only matches" do
    result = comparisons(
      [
        portfolio_skill(skill_id: nil, label: "Custom tool", level: 4),
        portfolio_skill(skill_id: nil, label: "Custom tool", level: 3)
      ],
      [vacancy_skill(skill_id: nil, label: "Custom tool", level: 3)]
    ).first

    expect(result[:result]).to eq("not_assessed")
    expect(result[:candidate_level]).to be_nil
  end

  it "refuses to compare a portfolio and vacancy from different tenants" do
    allow(vacancy).to receive(:tenant_id).and_return(2)

    expect {
      described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: gemini).call
    }.to raise_error(ActiveRecord::RecordNotFound)
  end
end
