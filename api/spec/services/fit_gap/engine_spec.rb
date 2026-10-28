# frozen_string_literal: true

require "rails_helper"

RSpec.describe FitGap::Engine do
  let(:generation_started_at) { Time.utc(2026, 10, 27, 16, 0, 0) }
  let(:generation_token) { "attempt-1" }
  let(:portfolio_skill_association) { double("portfolio skill association") }
  let(:portfolio_skill) do
    double(
      "portfolio skill",
      id: 5,
      skill_id: "sk-ruby",
      skill_label: "Ruby",
      ai_level: 3,
      ai_confidence: "medium",
      assessor_override: nil
    )
  end
  let(:vacancy_skill) do
    double("vacancy skill", skill_id: "sk-ruby", skill_label: "Ruby", expected_level: 4)
  end
  let(:vacancy) do
    double(
      "vacancy",
      id: 12,
      vacancy_skills: [vacancy_skill],
      role_title: "Backend Engineer",
      culture_dimensions: nil,
      competency_expectations: nil
    )
  end
  let(:assessment) { double("assessment") }
  let(:session) { double("session", assessment: assessment) }
  let(:portfolio) do
    double(
      "portfolio",
      id: 8,
      session: session,
      portfolio_skills: portfolio_skill_association
    )
  end
  let(:gemini_client) do
    double(
      "Gemini client",
      generate_content: {
        "culture_narrative" => "Culture context.",
        "overall_narrative" => "Overall context."
      }
    )
  end
  let(:report) do
    double(
      "fit/gap report",
      generation_status: "generating",
      generation_started_at: generation_started_at,
      generation_token: generation_token,
      update!: true
    )
  end

  subject(:engine) do
    described_class.new(
      portfolio: portfolio,
      vacancy: vacancy,
      generation_started_at: generation_started_at,
      generation_token: generation_token,
      gemini_client: gemini_client
    )
  end

  before do
    allow(report).to receive(:with_lock) { |&block| block.call }
    allow(portfolio_skill_association).to receive(:includes)
      .with(:assessor_override)
      .and_return([portfolio_skill])
    allow(FitGapReport).to receive(:find_or_initialize_by).and_return(report)
  end

  it "returns the API's expected-level contract and marks assessor overrides" do
    override = double("assessor override", override_level: 5)
    allow(portfolio_skill).to receive(:assessor_override).and_return(override)

    expect(report).to receive(:update!) do |attributes|
      comparison = attributes.fetch(:skill_comparisons).first
      expect(comparison).to include(
        skill_label: "Ruby",
        candidate_level: 5,
        expected_level: 4,
        result: "exceed",
        delta: 1,
        confidence: "medium",
        is_override: true
      )
      expect(attributes[:generation_status]).to eq("complete")
    end

    engine.call
  end

  it "uses the AI rating when no assessor override exists" do
    expect(report).to receive(:update!) do |attributes|
      expect(attributes.fetch(:skill_comparisons).first).to include(
        candidate_level: 3,
        expected_level: 4,
        result: "gap",
        delta: -1,
        confidence: "medium",
        is_override: false
      )
    end

    engine.call
  end

  it "keeps missing candidate ratings explicit when narrative generation times out" do
    allow(portfolio_skill_association).to receive(:includes).with(:assessor_override).and_return([])
    allow(gemini_client).to receive(:generate_content)
      .and_raise(Gemini::HttpClient::TimeoutError.new("timeout"))
    allow(Rails.logger).to receive(:error)

    expect(report).to receive(:update!) do |attributes|
      comparison = attributes.fetch(:skill_comparisons).first
      expect(comparison).to include(
        candidate_level: nil,
        expected_level: 4,
        result: "not_assessed",
        delta: nil,
        confidence: nil,
        is_override: false
      )
      expect(attributes[:culture_narrative]).to be_nil
      expect(attributes[:overall_narrative]).to include("1 role requirements were not assessed")
      expect(attributes[:overall_narrative]).to include("not a hiring recommendation")
      expect(attributes[:generation_status]).to eq("complete")
    end

    engine.call
  end

  it "falls back when the model returns no usable narrative text" do
    allow(gemini_client).to receive(:generate_content).and_return({})
    allow(Rails.logger).to receive(:error)

    expect(report).to receive(:update!) do |attributes|
      expect(attributes[:culture_narrative]).to be_nil
      expect(attributes[:overall_narrative]).to include("rule-based comparison")
    end

    engine.call
  end

  it "preserves duplicate vacancy requirements" do
    duplicate_skill = double("duplicate vacancy skill", skill_id: nil, skill_label: "Ruby", expected_level: 2)
    allow(vacancy).to receive(:vacancy_skills).and_return([vacancy_skill, duplicate_skill])

    expect(gemini_client).to receive(:generate_content).once.and_return(
      "culture_narrative" => "Culture context.",
      "overall_narrative" => "Overall context."
    )
    expect(report).to receive(:update!) do |attributes|
      expect(attributes.fetch(:skill_comparisons).length).to eq(2)
    end
    engine.call
  end

  it "does not call the model for an empty vacancy" do
    allow(vacancy).to receive(:vacancy_skills).and_return([])
    expect(gemini_client).not_to receive(:generate_content)
    expect(report).to receive(:update!) do |attributes|
      expect(attributes.fetch(:skill_comparisons)).to eq([])
      expect(attributes[:culture_narrative]).to be_nil
      expect(attributes[:overall_narrative]).to include("No role skill requirements are configured")
    end
    engine.call
  end

  it "does not let a superseded generation overwrite a newer report attempt" do
    superseded_engine = described_class.new(
      portfolio: portfolio,
      vacancy: vacancy,
      generation_started_at: generation_started_at - 1.second,
      generation_token: "superseded-attempt",
      gemini_client: gemini_client
    )
    expect(report).not_to receive(:update!)

    superseded_engine.call
  end
end
