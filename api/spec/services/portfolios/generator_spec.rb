# frozen_string_literal: true

require "rails_helper"

RSpec.describe Portfolios::Generator do
  let(:organization) { create(:organization) }
  let(:assessment) { create(:assessment, organization: organization) }
  let!(:react_skill) do
    create(:assessment_skill, assessment: assessment, skill_id: "sk-react", skill_label: "React")
  end
  let!(:comm_skill) do
    create(:assessment_skill, assessment: assessment, skill_id: "sk-comm", skill_label: "Communication")
  end
  let(:session) { create(:session, assessment: assessment) }

  def fake_client(response)
    instance_double(Gemini::HttpClient, generate_content: response)
  end

  def generate(response)
    described_class.new(session: session, gemini_client: fake_client(response)).call
  end

  it "marks a configured skill the AI never mentioned as not_assessed, not a fabricated low score" do
    response = {
      "configured_skills" => [
        { "skill_id" => "sk-react", "skill_label" => "React", "level" => 3, "confidence" => "high",
          "evidence" => ["quote"], "competency_summary" => "Solid." }
      ],
      "discovered_skills" => []
    }

    portfolio = generate(response)
    comm = portfolio.portfolio_skills.find_by(skill_label: "Communication")

    expect(comm.status).to eq("not_assessed")
    expect(comm.ai_level).to be_nil
    expect(comm.ai_confidence).to be_nil
  end

  it "marks a skill unparseable instead of defaulting to the lowest score when level is missing" do
    response = {
      "configured_skills" => [
        { "skill_id" => "sk-react", "skill_label" => "React", "level" => 3, "confidence" => "high",
          "evidence" => [], "competency_summary" => "ok" },
        { "skill_id" => "sk-comm", "skill_label" => "Communication", "level" => nil, "confidence" => "high",
          "evidence" => [], "competency_summary" => "ok" }
      ],
      "discovered_skills" => []
    }

    portfolio = generate(response)
    comm = portfolio.portfolio_skills.find_by(skill_label: "Communication")

    expect(comm.status).to eq("unparseable")
    expect(comm.ai_level).to be_nil
  end

  it "extracts a level embedded in a descriptive string" do
    response = {
      "configured_skills" => [
        { "skill_id" => "sk-react", "skill_label" => "React", "level" => "3 (Intermediate)",
          "confidence" => "medium", "evidence" => [], "competency_summary" => "ok" },
        { "skill_id" => "sk-comm", "skill_label" => "Communication", "level" => 2, "confidence" => "low",
          "evidence" => [], "competency_summary" => "ok" }
      ],
      "discovered_skills" => []
    }

    portfolio = generate(response)
    react = portfolio.portfolio_skills.find_by(skill_label: "React")

    expect(react.status).to eq("assessed")
    expect(react.ai_level).to eq(3)
  end

  it "defaults confidence to low instead of failing the skill when confidence is missing" do
    response = {
      "configured_skills" => [
        { "skill_id" => "sk-react", "skill_label" => "React", "level" => 4, "evidence" => [],
          "competency_summary" => "ok" },
        { "skill_id" => "sk-comm", "skill_label" => "Communication", "level" => 3, "confidence" => "high",
          "evidence" => [], "competency_summary" => "ok" }
      ],
      "discovered_skills" => []
    }

    portfolio = generate(response)
    react = portfolio.portfolio_skills.find_by(skill_label: "React")

    expect(react.status).to eq("assessed")
    expect(react.ai_confidence).to eq("low")
  end

  it "clamps an out-of-range but genuinely numeric level instead of rejecting it" do
    response = {
      "configured_skills" => [
        { "skill_id" => "sk-react", "skill_label" => "React", "level" => 9, "confidence" => "high",
          "evidence" => [], "competency_summary" => "ok" },
        { "skill_id" => "sk-comm", "skill_label" => "Communication", "level" => 3, "confidence" => "high",
          "evidence" => [], "competency_summary" => "ok" }
      ],
      "discovered_skills" => []
    }

    portfolio = generate(response)
    react = portfolio.portfolio_skills.find_by(skill_label: "React")

    expect(react.status).to eq("assessed")
    expect(react.ai_level).to eq(5)
  end

  it "creates a discovered skill as assessed alongside not_assessed configured skills" do
    response = {
      "configured_skills" => [],
      "discovered_skills" => [
        { "skill_label" => "Micro-frontends", "level" => 2, "confidence" => "low", "evidence" => ["q"],
          "competency_summary" => "ok" }
      ]
    }

    portfolio = generate(response)

    expect(portfolio.portfolio_skills.where(status: "not_assessed").count).to eq(2)
    discovered = portfolio.portfolio_skills.find_by(is_discovered: true)
    expect(discovered.status).to eq("assessed")
    expect(discovered.ai_level).to eq(2)
  end

  it "matches a configured skill by label when the AI omits skill_id" do
    response = {
      "configured_skills" => [
        { "skill_label" => "React", "level" => 4, "confidence" => "high", "evidence" => [],
          "competency_summary" => "ok" },
        { "skill_id" => "sk-comm", "skill_label" => "Communication", "level" => 3, "confidence" => "high",
          "evidence" => [], "competency_summary" => "ok" }
      ],
      "discovered_skills" => []
    }

    portfolio = generate(response)
    react = portfolio.portfolio_skills.find_by(skill_label: "React")

    expect(react.status).to eq("assessed")
    expect(react.ai_level).to eq(4)
  end
end
