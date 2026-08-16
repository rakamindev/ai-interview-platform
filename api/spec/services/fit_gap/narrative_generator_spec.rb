# frozen_string_literal: true

require "rails_helper"
require_relative "../../../app/services/fit_gap/narrative_generator"

RSpec.describe FitGap::NarrativeGenerator do
  let(:gemini_client) { double("GeminiClient") }

  def build_generator(vacancy:)
    described_class.new(vacancy: vacancy, gemini_client: gemini_client)
  end

  describe "#generate_narrative!" do
    it "returns both narrative fields from valid Gemini JSON" do
      vacancy = double(
        "Vacancy",
        role_title: "Senior Frontend Engineer",
        culture_dimensions: "Collaborative",
        competency_expectations: "Clear communication"
      )
      allow(gemini_client).to receive(:generate_content).and_return(
        "culture_narrative" => "Strong collaboration signal.",
        "overall_narrative" => "Human review should focus on the gap."
      )

      generator = build_generator(vacancy: vacancy)

      result = generator.generate_narrative!([
        { result: "gap", skill_label: "TypeScript", candidate_level: 2, expected_level: 3, delta: -1 },
        { result: "match", skill_label: "React", candidate_level: 3, expected_level: 3, delta: 0 },
        { result: "not_assessed", skill_label: "Communication", candidate_level: nil, expected_level: 3, delta: nil }
      ])

      expect(result).to eq(
        culture: "Strong collaboration signal.",
        overall: "Human review should focus on the gap."
      )
    end

    it "raises when Gemini returns malformed or incomplete output" do
      vacancy = double(
        "Vacancy",
        role_title: "Senior Frontend Engineer",
        culture_dimensions: nil,
        competency_expectations: nil
      )
      generator = build_generator(vacancy: vacancy)

      allow(gemini_client).to receive(:generate_content).and_return("not-json")
      expect {
        generator.generate_narrative!([])
      }.to raise_error(FitGap::NarrativeGenerationError)

      allow(gemini_client).to receive(:generate_content).and_return({})
      expect {
        generator.generate_narrative!([])
      }.to raise_error(FitGap::NarrativeGenerationError)
    end
  end
end
