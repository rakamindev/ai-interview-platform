require_relative "../../spec_helper"
require_relative "../../../app/services/portfolios/result_normalizer"

RSpec.describe Portfolios::ResultNormalizer do
  Skill = Struct.new(:skill_id, :skill_label, keyword_init: true)

  let(:assessment_skills) do
    [
      Skill.new(skill_id: "react", skill_label: "React"),
      Skill.new(skill_id: "ruby", skill_label: "Ruby"),
    ]
  end

  it "keeps a configured skill visible when the model omits its rating" do
    result = described_class.new(
      assessment_skills: assessment_skills,
      response: { "configured_skills" => [{ "skill_id" => "react", "level" => 3, "confidence" => "high", "evidence" => ["Built a design system"], "competency_summary" => "Consistent delivery." }] }
    ).call

    expect(result).to include(
      hash_including(
        skill_id: "ruby",
        skill_label: "Ruby",
        rating_status: "not_assessed",
        ai_level: 1,
        ai_confidence: "low",
        evidence: []
      )
    )
  end

  it "does not turn an invalid model level into the highest rating" do
    result = described_class.new(
      assessment_skills: [assessment_skills.first],
      response: { "configured_skills" => [{ "skill_id" => "react", "level" => 99, "confidence" => "high", "evidence" => ["Unsupported claim"], "competency_summary" => "Untrusted." }] }
    ).call

    expect(result.first).to include(
      rating_status: "not_assessed",
      ai_level: 1,
      ai_confidence: "low",
      evidence: []
    )
  end

  it "accepts numeric string levels and limits evidence to three strings" do
    result = described_class.new(
      assessment_skills: [assessment_skills.first],
      response: { "configured_skills" => [{ "skill_id" => "react", "level" => "4", "confidence" => "medium", "evidence" => ["one", 2, "two", "three", "four"], "competency_summary" => "Strong delivery." }] }
    ).call

    expect(result.first).to include(
      rating_status: "rated",
      ai_level: 4,
      ai_confidence: "medium",
      evidence: ["one", "two", "three"]
    )
  end

  it "rejects malformed model output before persistence can begin" do
    expect {
      described_class.new(assessment_skills: assessment_skills, response: "not-json").call
    }.to raise_error(Portfolios::ResultNormalizer::InvalidResponse)
  end

  it "rejects a configured skill collection with the wrong type" do
    expect {
      described_class.new(
        assessment_skills: assessment_skills,
        response: { "configured_skills" => "malformed" }
      ).call
    }.to raise_error(Portfolios::ResultNormalizer::InvalidResponse)
  end
end
