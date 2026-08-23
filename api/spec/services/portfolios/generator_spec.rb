# frozen_string_literal: true

require "rails_helper"

RSpec.describe Portfolios::Generator do
  let(:assessment) { create(:assessment, :with_skills, skills_count: 2) }
  let(:skill_a)    { assessment.assessment_skills.first }
  let(:skill_b)    { assessment.assessment_skills.second }
  let(:session)    { create(:session, assessment:) }
  let(:gemini_client) { instance_double(Gemini::HttpClient) }

  subject(:generator) { described_class.new(session:, gemini_client:) }

  def gemini_returns(payload)
    allow(gemini_client).to receive(:generate_content).and_return(payload)
  end

  describe "happy path" do
    it "creates a rated portfolio skill for every configured skill Gemini returns" do
      gemini_returns(
        "configured_skills" => [
          { "skill_id" => skill_a.skill_id, "skill_label" => skill_a.skill_label,
            "level" => 3, "confidence" => "high", "evidence" => ["quote"], "competency_summary" => "summary" },
          { "skill_id" => skill_b.skill_id, "skill_label" => skill_b.skill_label,
            "level" => 4, "confidence" => "medium", "evidence" => [], "competency_summary" => "summary 2" }
        ],
        "discovered_skills" => []
      )

      portfolio = generator.call

      expect(portfolio.generation_status).to eq("complete")
      expect(portfolio.portfolio_skills.count).to eq(2)
      expect(portfolio.portfolio_skills.pluck(:status)).to all(eq("rated"))
    end
  end

  describe "a configured skill missing from Gemini's response" do
    it "still creates a portfolio skill row, marked not_assessed" do
      gemini_returns(
        "configured_skills" => [
          { "skill_id" => skill_a.skill_id, "skill_label" => skill_a.skill_label,
            "level" => 3, "confidence" => "high", "evidence" => [], "competency_summary" => "summary" }
        ],
        "discovered_skills" => []
      )

      portfolio = generator.call

      not_assessed = portfolio.reload.portfolio_skills.find_by(skill_id: skill_b.skill_id)
      expect(not_assessed).to be_present
      expect(not_assessed.status).to eq("not_assessed")
      expect(not_assessed.ai_level).to be_nil
    end
  end

  describe "a skill with an invalid/missing level from Gemini" do
    it "is stored as not_assessed instead of silently coerced to level 1" do
      gemini_returns(
        "configured_skills" => [
          { "skill_id" => skill_a.skill_id, "skill_label" => skill_a.skill_label,
            "level" => nil, "confidence" => "high", "evidence" => [], "competency_summary" => "summary" },
          { "skill_id" => skill_b.skill_id, "skill_label" => skill_b.skill_label,
            "level" => 3, "confidence" => "medium", "evidence" => [], "competency_summary" => "summary 2" }
        ],
        "discovered_skills" => []
      )

      portfolio = generator.call

      skill = portfolio.portfolio_skills.find_by(skill_id: skill_a.skill_id)
      expect(skill.status).to eq("not_assessed")
      expect(skill.ai_level).to be_nil
    end
  end

  describe "Gemini call fails outright" do
    it "marks the portfolio failed and leaves no portfolio_skills behind" do
      allow(gemini_client).to receive(:generate_content).and_raise(Gemini::HttpClient::ApiError, "boom")

      expect { generator.call }.to raise_error(Gemini::HttpClient::ApiError)

      portfolio = session.reload.portfolio
      expect(portfolio.generation_status).to eq("failed")
      expect(portfolio.generation_error).to include("boom")
      expect(portfolio.portfolio_skills.count).to eq(0)
    end
  end

  describe "a retry succeeds after an earlier attempt left a stale error" do
    it "clears generation_error instead of leaving it behind on a completed portfolio" do
      portfolio = session.create_portfolio!(candidate_id: session.candidate_id,
                                             generation_status: "failed", generation_error: "boom")
      gemini_returns(
        "configured_skills" => [
          { "skill_id" => skill_a.skill_id, "skill_label" => skill_a.skill_label,
            "level" => 3, "confidence" => "high", "evidence" => [], "competency_summary" => "summary" },
          { "skill_id" => skill_b.skill_id, "skill_label" => skill_b.skill_label,
            "level" => 3, "confidence" => "high", "evidence" => [], "competency_summary" => "summary 2" }
        ],
        "discovered_skills" => []
      )

      generator.call

      expect(portfolio.reload.generation_error).to be_nil
    end
  end

  describe "a save fails partway through" do
    it "rolls back the whole batch instead of leaving a partial portfolio" do
      gemini_returns(
        "configured_skills" => [
          { "skill_id" => skill_a.skill_id, "skill_label" => skill_a.skill_label,
            "level" => 3, "confidence" => "high", "evidence" => [], "competency_summary" => "summary" },
          { "skill_id" => skill_b.skill_id, "skill_label" => skill_b.skill_label,
            "level" => 3, "confidence" => "extreme", "evidence" => [], "competency_summary" => "summary 2" }
        ],
        "discovered_skills" => []
      )

      expect { generator.call }.to raise_error(ActiveRecord::RecordInvalid)

      portfolio = session.reload.portfolio
      expect(portfolio.generation_status).to eq("failed")
      expect(portfolio.portfolio_skills.count).to eq(0)
    end
  end

  describe "regenerating an existing portfolio" do
    it "replaces old skills cleanly instead of duplicating them" do
      gemini_returns(
        "configured_skills" => [
          { "skill_id" => skill_a.skill_id, "skill_label" => skill_a.skill_label,
            "level" => 2, "confidence" => "low", "evidence" => [], "competency_summary" => "first pass" }
        ],
        "discovered_skills" => []
      )
      generator.call

      gemini_returns(
        "configured_skills" => [
          { "skill_id" => skill_a.skill_id, "skill_label" => skill_a.skill_label,
            "level" => 4, "confidence" => "high", "evidence" => [], "competency_summary" => "second pass" }
        ],
        "discovered_skills" => []
      )
      portfolio = described_class.new(session: session.reload, gemini_client:).call

      expect(portfolio.portfolio_skills.where(skill_id: skill_a.skill_id).count).to eq(1)
      expect(portfolio.portfolio_skills.find_by(skill_id: skill_a.skill_id).competency_summary).to eq("second pass")
    end
  end

  describe "coverage was never tracked live but a transcript exists" do
    let!(:map_a) { create(:coverage_map, session:, skill_id: skill_a.skill_id, skill_label: skill_a.skill_label) }
    let!(:map_b) { create(:coverage_map, session:, skill_id: skill_b.skill_id, skill_label: skill_b.skill_label) }
    let(:worker) { instance_double(CoverageAnalyzerWorker) }

    before do
      session.transcript_turns.create!(turn_number: 1, speaker: "ai", text: "Q1")
      session.transcript_turns.create!(turn_number: 2, speaker: "candidate", text: "A1")
      session.transcript_turns.create!(turn_number: 3, speaker: "ai", text: "Q2")
      session.transcript_turns.create!(turn_number: 4, speaker: "candidate", text: "A2")

      allow(CoverageAnalyzerWorker).to receive(:new).and_return(worker)
      allow(worker).to receive(:perform)

      gemini_returns("configured_skills" => [], "discovered_skills" => [])
    end

    it "backfills coverage from the saved transcript, one candidate turn at a time, before generating" do
      generator.call

      expect(worker).to have_received(:perform).with(session.id, 2, force: true)
      expect(worker).to have_received(:perform).with(session.id, 4, force: true)
      expect(worker).to have_received(:perform).twice
    end
  end

  describe "coverage already has probes recorded" do
    let!(:map_a) { create(:coverage_map, session:, skill_id: skill_a.skill_id, probe_count: 1) }

    before do
      session.transcript_turns.create!(turn_number: 1, speaker: "candidate", text: "A1")
      gemini_returns("configured_skills" => [], "discovered_skills" => [])
    end

    it "does not re-run analysis" do
      expect(CoverageAnalyzerWorker).not_to receive(:new)
      generator.call
    end
  end

  describe "a custom skill (no real skill_id) where Gemini invents its own id format" do
    it "still matches on skill_label instead of discarding the rating" do
      custom_skill = create(:assessment_skill, assessment:, skill_id: nil, skill_label: "Node.js / Backend Development")
      session2 = create(:session, assessment:)
      generator2 = described_class.new(session: session2, gemini_client:)

      gemini_returns(
        "configured_skills" => [
          { "skill_id" => "node.js-/-backend-development", "skill_label" => custom_skill.skill_label,
            "level" => 2, "confidence" => "high", "evidence" => [], "competency_summary" => "summary" }
        ],
        "discovered_skills" => []
      )

      portfolio = generator2.call

      rated = portfolio.portfolio_skills.find_by(skill_label: custom_skill.skill_label)
      expect(rated.status).to eq("rated")
      expect(rated.ai_level).to eq(2)
    end
  end

  describe "concurrent/duplicate generation jobs" do
    it "refuses to run a second time while a generation is already in progress" do
      portfolio = session.create_portfolio!(generation_status: "generating")

      expect(gemini_client).not_to receive(:generate_content)
      expect { generator.call }.to raise_error(Portfolios::Generator::ConcurrentGenerationError)
      expect(portfolio.reload.generation_status).to eq("generating")
    end
  end
end
