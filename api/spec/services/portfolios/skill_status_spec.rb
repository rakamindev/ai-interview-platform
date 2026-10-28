# frozen_string_literal: true

require "rails_helper"

RSpec.describe Portfolios::SkillStatus do
  describe ".parse_level" do
    # AC-3: accepts 3, "3", "L3" (case-insensitive) as 3; 3.0 as 3.
    # Rejects 3.7, 0, 6, -1, "", nil, "three" — never clamps into range.
    {
      3 => 3,
      "3" => 3,
      "L3" => 3,
      "l3" => 3,
      3.0 => 3,
      3.7 => nil,
      0 => nil,
      6 => nil,
      -1 => nil,
      "" => nil,
      nil => nil,
      "three" => nil,
      "L7" => nil,
      [3] => nil,
    }.each do |input, expected|
      it "parses #{input.inspect} as #{expected.inspect}" do
        expect(described_class.parse_level(input)).to eq(expected)
      end
    end
  end

  describe ".derive" do
    # AC-1: coverage not_yet (or no coverage row at all) -> not_assessed,
    # regardless of what level the LLM reported.
    context "when the skill was never reached" do
      it "is not_assessed even if the LLM reported a confident level" do
        coverage = build(:coverage_map, state: "not_yet", probe_count: 0)

        result = described_class.derive(coverage: coverage, raw_level: 4, evidence_count: 3)

        expect(result.status).to eq("not_assessed")
        expect(result.level).to be_nil
      end

      it "is not_assessed when there is no coverage row at all" do
        result = described_class.derive(coverage: nil, raw_level: 4, evidence_count: 3)

        expect(result.status).to eq("not_assessed")
        expect(result.level).to be_nil
      end
    end

    # AC-2: probed once (initiated), or zero evidence, -> insufficient_evidence.
    context "when the skill was only briefly probed" do
      it "is insufficient_evidence for a single probe even with a level and evidence" do
        coverage = build(:coverage_map, state: "initiated", probe_count: 1)

        result = described_class.derive(coverage: coverage, raw_level: 3, evidence_count: 1)

        expect(result.status).to eq("insufficient_evidence")
        expect(result.level).to eq(3) # provisional level is kept, just not trusted as a verdict
      end

      it "is insufficient_evidence for a covered skill with zero evidence quotes" do
        coverage = build(:coverage_map, state: "covered", probe_count: 3)

        result = described_class.derive(coverage: coverage, raw_level: 3, evidence_count: 0)

        expect(result.status).to eq("insufficient_evidence")
      end

      it "is insufficient_evidence when the LLM's level can't be parsed, even if coverage is strong" do
        coverage = build(:coverage_map, state: "covered", probe_count: 4)

        result = described_class.derive(coverage: coverage, raw_level: "unknown", evidence_count: 2)

        expect(result.status).to eq("insufficient_evidence")
        expect(result.level).to be_nil
      end
    end

    # Positive case: real coverage, parseable level, real evidence -> assessed.
    context "when the skill was genuinely covered" do
      it "is assessed with high confidence at 3+ probes" do
        coverage = build(:coverage_map, state: "covered", probe_count: 3)

        result = described_class.derive(coverage: coverage, raw_level: 4, evidence_count: 2)

        expect(result.status).to eq("assessed")
        expect(result.level).to eq(4)
        expect(result.confidence).to eq("high")
      end

      it "is assessed with medium confidence at exactly 2 probes (partial)" do
        coverage = build(:coverage_map, state: "partial", probe_count: 2)

        result = described_class.derive(coverage: coverage, raw_level: 2, evidence_count: 1)

        expect(result.status).to eq("assessed")
        expect(result.confidence).to eq("medium")
      end
    end
  end
end
