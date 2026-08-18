# frozen_string_literal: true

require "rails_helper"
require_relative "../../../app/services/portfolios/output_validator"

RSpec.describe Portfolios::OutputValidator do
  let(:assessment_skills) do
    [
      double("AssessmentSkill", skill_id: "react", skill_label: "React / Frontend Development", display_order: 0),
      double("AssessmentSkill", skill_id: "typescript", skill_label: "TypeScript & Type Systems", display_order: 1)
    ]
  end
  let(:assessment_skill_relation) { double("AssessmentSkills") }
  let(:assessment) { double("Assessment", assessment_skills: assessment_skill_relation) }

  before do
    allow(assessment_skill_relation).to receive(:order).with(:display_order).and_return(assessment_skills)
  end

  def valid_payload
    {
      "configured_skills" => [
        {
          "skill_id" => "react",
          "skill_label" => "React / Frontend Development",
          "level" => 3,
          "confidence" => "high",
          "evidence" => ["I designed a reusable component system."],
          "competency_summary" => "Builds maintainable frontend systems."
        },
        {
          "skill_id" => "typescript",
          "skill_label" => "TypeScript & Type Systems",
          "level" => 3,
          "confidence" => "medium",
          "evidence" => [],
          "competency_summary" => "Uses types to model API contracts."
        }
      ],
      "discovered_skills" => []
    }
  end

  it "validates and canonicalizes configured skills" do
    result = described_class.new(data: valid_payload, assessment: assessment).call

    expect(result[:configured_skills].map { |skill| skill[:skill_label] }).to eq([
      "React / Frontend Development",
      "TypeScript & Type Systems"
    ])
    expect(result[:configured_skills].first[:level]).to eq(3)
  end

  it "falls back to exact label for custom skills with synthesized IDs" do
    custom_skill = double(
      "AssessmentSkill",
      skill_id: nil,
      skill_label: "React / Frontend Development Core",
      display_order: 0
    )
    custom_relation = double("AssessmentSkills")
    custom_assessment = double("Assessment", assessment_skills: custom_relation)
    allow(custom_relation).to receive(:order).with(:display_order).and_return([custom_skill])

    payload = {
      "configured_skills" => [{
        "skill_id" => "react-/-frontend-development-core",
        "skill_label" => "React / Frontend Development Core",
        "level" => 3,
        "confidence" => "medium",
        "evidence" => [],
        "competency_summary" => "Uses React in production."
      }],
      "discovered_skills" => []
    }

    result = described_class.new(data: payload, assessment: custom_assessment).call

    expect(result[:configured_skills].first).to include(
      skill_id: nil,
      skill_label: "React / Frontend Development Core"
    )
  end

  it "rejects missing configured skills instead of saving a partial portfolio" do
    payload = valid_payload
    payload["configured_skills"] = [payload["configured_skills"].first]

    expect {
      described_class.new(data: payload, assessment: assessment).call
    }.to raise_error(Portfolios::InvalidOutput, /missing configured skill/)
  end

  it "rejects invalid level, confidence, and evidence types" do
    payload = valid_payload
    payload["configured_skills"][0]["level"] = "L3"
    payload["configured_skills"][0]["confidence"] = "certain"
    payload["configured_skills"][0]["evidence"] = "not an array"

    expect {
      described_class.new(data: payload, assessment: assessment).call
    }.to raise_error(Portfolios::InvalidOutput)
  end

  it "rejects duplicate discovered skill labels" do
    payload = valid_payload.merge(
      "discovered_skills" => [
        {
          "skill_label" => "GraphQL",
          "level" => 2,
          "confidence" => "low",
          "evidence" => ["I used GraphQL at work."],
          "competency_summary" => "Has limited GraphQL exposure."
        },
        {
          "skill_label" => " graphql ",
          "level" => 2,
          "confidence" => "low",
          "evidence" => ["I used GraphQL at work."],
          "competency_summary" => "Has limited GraphQL exposure."
        }
      ]
    )

    expect {
      described_class.new(data: payload, assessment: assessment).call
    }.to raise_error(Portfolios::InvalidOutput, /duplicate skill/)
  end
end
