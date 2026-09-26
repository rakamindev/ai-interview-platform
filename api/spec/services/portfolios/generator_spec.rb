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

  describe "failure and duplicate-job handling" do
    let(:failing_client) do
      instance_double(Gemini::HttpClient).tap do |c|
        allow(c).to receive(:generate_content).and_raise(StandardError, "boom key=SECRET123")
      end
    end

    it "re-raises a model failure so Sidekiq retries, instead of saving an all-not_assessed portfolio as complete" do
      portfolio = create(:portfolio, session: session, generation_status: "pending")

      expect { described_class.new(session: session, gemini_client: failing_client).call }.to raise_error(StandardError)

      portfolio.reload
      expect(portfolio.generation_status).to eq("pending")
      expect(portfolio.portfolio_skills).to be_empty
    end

    it "does not persist the raw model error message (may echo request details)" do
      portfolio = create(:portfolio, session: session, generation_status: "pending")

      begin
        described_class.new(session: session, gemini_client: failing_client).call
      rescue StandardError
        nil
      end

      expect(portfolio.reload.generation_error.to_s).not_to include("SECRET123")
    end

    it "keeps existing skill scores when regeneration fails part-way through saving" do
      portfolio = create(:portfolio, session: session, generation_status: "pending")
      keep = create(:portfolio_skill, portfolio: portfolio, skill_label: "React", ai_level: 4)
      bad = { "configured_skills" => [], "discovered_skills" => [{ "skill_label" => nil, "level" => 2 }] }

      expect { generate(bad) }.to raise_error(ActiveRecord::RecordInvalid)

      expect(PortfolioSkill.exists?(keep.id)).to be(true)
      expect(portfolio.reload.generation_status).to eq("pending")
    end

    it "skips a duplicate job when the portfolio is already complete" do
      create(:portfolio, session: session, generation_status: "complete")
      client = fake_client({ "configured_skills" => [], "discovered_skills" => [] })

      described_class.new(session: session, gemini_client: client).call

      expect(client).not_to have_received(:generate_content)
    end

    it "skips a duplicate job while another worker is actively generating" do
      create(:portfolio, session: session, generation_status: "generating", generation_started_at: 1.minute.ago)
      client = fake_client({ "configured_skills" => [], "discovered_skills" => [] })

      described_class.new(session: session, gemini_client: client).call

      expect(client).not_to have_received(:generate_content)
    end

    it "takes over a stale 'generating' portfolio left behind by a crashed worker" do
      create(:portfolio, session: session, generation_status: "generating", generation_started_at: 1.hour.ago)

      portfolio = generate({ "configured_skills" => [], "discovered_skills" => [] })

      expect(portfolio.generation_status).to eq("complete")
    end
  end
end
