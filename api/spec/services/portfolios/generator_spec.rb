# frozen_string_literal: true

require "rails_helper"

RSpec.describe Portfolios::Generator do
  before { Current.clear }

  def create_portfolio_fixture
    organization = Organization.create!(
      name: "portfolio-generator-test", scheme: "portfolio-generator-test",
      identifier: "portfolio-generator-test", host: "portfolio-generator-test.example.test",
      alias_hosts: [], config: {}
    )
    assessment = Assessment.create!(
      tenant_id: organization.id, created_by: 9003, name: "Synthetic assessment",
      time_limit_min: 30, language: "en"
    )
    definition = AssessmentSkill.create!(
      assessment: assessment, skill_id: "skill-ruby", skill_label: "Ruby", is_custom: false,
      l1_anchor: "L1", l2_anchor: "L2", l3_anchor: "L3", l4_anchor: "L4", l5_anchor: "L5",
      display_order: 1
    )
    session = Session.create!(tenant_id: organization.id, assessment: assessment, status: "ended")
    TranscriptTurn.create!(session: session, turn_number: 1, speaker: "candidate",
                           text: "I debugged a production incident and wrote a postmortem.")
    portfolio = Portfolio.create!(session: session, generation_status: "complete")
    skill = PortfolioSkill.create!(
      portfolio: portfolio, skill_id: definition.skill_id, skill_label: definition.skill_label,
      is_discovered: false, ai_level: 3, ai_confidence: "medium",
      evidence: ["I debugged a production incident."], competency_summary: "Baseline summary"
    )
    override = AssessorOverride.create!(
      portfolio_skill: skill, ai_level: 3, override_level: 2,
      assessor_notes: "Human review", overridden_by: 9003
    )
    [session, portfolio, skill, override]
  end

  it "preserves human overrides when refreshing the AI baseline" do
    session, portfolio, skill, override = create_portfolio_fixture
    generator = described_class.new(session: session, gemini_client: double("Gemini client"))
    response = {
      "configured_skills" => [{
        "skill_id" => "skill-ruby", "skill_label" => "Ruby", "level" => 4,
        "confidence" => "high", "evidence" => ["I debugged a production incident."],
        "competency_summary" => "Updated evidence-based summary"
      }],
      "discovered_skills" => []
    }

    generator.send(:save_skills, portfolio, response)

    expect(portfolio.portfolio_skills.find(skill.id).ai_level).to eq(4)
    expect(override.reload.override_level).to eq(2)
    expect(override.ai_level).to eq(4)
    expect(override.assessor_notes).to eq("Human review")
  end

  it "does not persist provider exception details when generation fails" do
    session, portfolio, = create_portfolio_fixture
    client = double("Gemini client")
    allow(client).to receive(:generate_content).and_raise(StandardError, "private provider response payload")
    generator = described_class.new(session: session, gemini_client: client)

    expect(Rails.logger).to receive(:error).with("[N10] Portfolio generation failed for session #{session.id}: StandardError")

    expect { generator.call }.to raise_error(StandardError, "private provider response payload")
    expect(portfolio.reload.generation_status).to eq("failed")
    expect(portfolio.generation_error).to eq("Portfolio generation failed. Please retry.")
  end

  it "rejects malformed model output before replacing existing skills" do
    session, portfolio, skill, = create_portfolio_fixture
    generator = described_class.new(session: session, gemini_client: double("Gemini client"))
    malformed = { "configured_skills" => [{ "skill_id" => "unknown", "skill_label" => "Fake", "level" => 3 }],
                  "discovered_skills" => [] }

    expect { generator.send(:save_skills, portfolio, malformed) }.to raise_error(JSON::ParserError)
    expect(portfolio.portfolio_skills.pluck(:id)).to include(skill.id)
    expect(portfolio.portfolio_skills.count).to eq(1)
  end
end
