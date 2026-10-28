# frozen_string_literal: true

require "rails_helper"

RSpec.describe Portfolios::Generator do
  # A minimal stand-in for Gemini::HttpClient — Generator only ever calls
  # #generate_content on it, so a double that returns a canned response (or
  # raises) is enough to test the generator's own logic without a real
  # network call or Gemini::HttpClient's parsing behavior.
  let(:fake_client) { instance_double(Gemini::HttpClient) }

  def build_session_with_skills(skill_specs)
    session = nil
    with_tenant(1) do
      assessment = create(:assessment)
      skill_specs.each_with_index do |spec, i|
        create(:assessment_skill, assessment: assessment, skill_id: spec[:skill_id],
                                   skill_label: spec[:skill_label], display_order: i)
      end
      session = create(:session, assessment: assessment)
      skill_specs.each do |spec|
        create(:coverage_map, session: session, skill_id: spec[:skill_id],
                               skill_label: spec[:skill_label],
                               state: spec[:state], probe_count: spec[:probe_count])
      end
    end
    session
  end

  describe "#call" do
    # AC-1 / AC-5: a configured skill untouched by the interview is stored
    # as not_assessed, even when the LLM still reports a confident level for
    # it — this is the central bug the whole revamp exists to fix.
    it "marks an uncovered skill not_assessed regardless of the level the LLM reports" do
      session = build_session_with_skills([
        { skill_id: "SK-1", skill_label: "React", state: "covered", probe_count: 3 },
        { skill_id: "SK-2", skill_label: "Cloud Infra", state: "not_yet", probe_count: 0 },
      ])

      allow(fake_client).to receive(:generate_content).and_return({
        "configured_skills" => [
          { "skill_id" => "SK-1", "skill_label" => "React", "level" => 4, "confidence" => "high",
            "evidence" => ["concrete example one", "concrete example two"], "competency_summary" => "Strong." },
          # The LLM answers for the untouched skill anyway — this must not
          # survive as a real level.
          { "skill_id" => "SK-2", "skill_label" => "Cloud Infra", "level" => 1, "confidence" => "low",
            "evidence" => [], "competency_summary" => "Guessed from nothing." },
        ],
        "discovered_skills" => [],
      }.to_json)

      portfolio = described_class.new(session: session, gemini_client: fake_client).call

      react = portfolio.portfolio_skills.find_by(skill_id: "SK-1")
      cloud = portfolio.portfolio_skills.find_by(skill_id: "SK-2")

      expect(react.assessment_status).to eq("assessed")
      expect(react.ai_level).to eq(4)

      expect(cloud.assessment_status).to eq("not_assessed")
      expect(cloud.ai_level).to be_nil
    end

    # AC-5: a configured skill the LLM's response omits entirely still gets
    # a row, rather than silently vanishing from the report. When coverage
    # also never reached it, that row is not_assessed.
    it "still creates a not_assessed row for an uncovered skill missing from the LLM response" do
      session = build_session_with_skills([
        { skill_id: "SK-1", skill_label: "React", state: "not_yet", probe_count: 0 },
      ])

      allow(fake_client).to receive(:generate_content).and_return({
        "configured_skills" => [], "discovered_skills" => [],
      }.to_json)

      portfolio = described_class.new(session: session, gemini_client: fake_client).call

      expect(portfolio.portfolio_skills.count).to eq(1)
      skill = portfolio.portfolio_skills.first
      expect(skill.assessment_status).to eq("not_assessed")
    end

    # Same guarantee (the row isn't dropped), but when coverage shows the
    # skill WAS discussed and only the LLM's response omitted it, that's a
    # response gap, not an uncovered skill — insufficient_evidence, not
    # not_assessed, since the interview itself isn't the thing that failed.
    it "still creates a row, as insufficient_evidence, when a covered skill is missing from the LLM response" do
      session = build_session_with_skills([
        { skill_id: "SK-1", skill_label: "React", state: "covered", probe_count: 3 },
      ])

      allow(fake_client).to receive(:generate_content).and_return({
        "configured_skills" => [], "discovered_skills" => [],
      }.to_json)

      portfolio = described_class.new(session: session, gemini_client: fake_client).call

      expect(portfolio.portfolio_skills.count).to eq(1)
      expect(portfolio.portfolio_skills.first.assessment_status).to eq("insufficient_evidence")
    end

    # AC-6: matched by skill_id first; falls back to a normalized label match
    # when the LLM's response omits/garbles skill_id but gets the label right.
    it "matches a response entry by label when skill_id is missing from the response" do
      session = build_session_with_skills([
        { skill_id: "SK-1", skill_label: "React / Frontend Development Core", state: "covered", probe_count: 3 },
      ])

      allow(fake_client).to receive(:generate_content).and_return({
        "configured_skills" => [
          { "skill_label" => "  react / frontend development core  ", "level" => 3, "confidence" => "medium",
            "evidence" => ["a quote"], "competency_summary" => "Solid." },
        ],
        "discovered_skills" => [],
      }.to_json)

      portfolio = described_class.new(session: session, gemini_client: fake_client).call
      skill = portfolio.portfolio_skills.first

      expect(skill.assessment_status).to eq("assessed")
      expect(skill.ai_level).to eq(3)
    end

    # AC-3: a string level like "L3" parses correctly instead of becoming 1
    # via the old `.to_i.clamp(1,5)` bug ("L3".to_i == 0).
    it "parses a string level like L3 correctly rather than defaulting to 1" do
      session = build_session_with_skills([
        { skill_id: "SK-1", skill_label: "React", state: "covered", probe_count: 3 },
      ])

      allow(fake_client).to receive(:generate_content).and_return({
        "configured_skills" => [
          { "skill_id" => "SK-1", "skill_label" => "React", "level" => "L3", "confidence" => "high",
            "evidence" => ["a quote", "another quote"], "competency_summary" => "Solid." },
        ],
        "discovered_skills" => [],
      }.to_json)

      portfolio = described_class.new(session: session, gemini_client: fake_client).call
      expect(portfolio.portfolio_skills.first.ai_level).to eq(3)
    end

    # A discovered skill is, by construction, never not_assessed — even if
    # its matched coverage row (if any) looks like "not_yet".
    it "never marks a discovered skill not_assessed" do
      session = build_session_with_skills([])

      allow(fake_client).to receive(:generate_content).and_return({
        "configured_skills" => [],
        "discovered_skills" => [
          { "skill_label" => "Rust", "level" => nil, "confidence" => "low",
            "evidence" => [], "competency_summary" => "Mentioned once in passing." },
        ],
      }.to_json)

      portfolio = described_class.new(session: session, gemini_client: fake_client).call
      skill = portfolio.portfolio_skills.find_by(is_discovered: true)

      expect(skill.assessment_status).to eq("insufficient_evidence")
    end

    # AC-13: a mid-loop validation failure must not leave a partial skill
    # set. ai_confidence is derived from coverage data (never trusted
    # straight from the LLM — see Portfolios::SkillStatus), so the
    # realistic way this still fails today is a malformed discovered skill
    # — skill_label comes straight from the LLM with no fallback for those.
    it "rolls back every skill for this portfolio if one fails to save" do
      session = build_session_with_skills([
        { skill_id: "SK-1", skill_label: "React", state: "covered", probe_count: 3 },
      ])

      allow(fake_client).to receive(:generate_content).and_return({
        "configured_skills" => [
          { "skill_id" => "SK-1", "skill_label" => "React", "level" => 3, "confidence" => "high",
            "evidence" => ["q1"], "competency_summary" => "Fine." },
        ],
        "discovered_skills" => [
          { "skill_label" => "", "level" => 2, "confidence" => "low",
            "evidence" => ["q1"], "competency_summary" => "Fine." },
        ],
      }.to_json)

      expect {
        described_class.new(session: session, gemini_client: fake_client).call
      }.to raise_error(ActiveRecord::RecordInvalid)

      # The configured skill (React) would otherwise have saved successfully
      # on its own — proving it did NOT survive is what proves the
      # transaction, not just that the bad row failed.
      expect(session.reload.portfolio.portfolio_skills.count).to eq(0)
      expect(session.portfolio.generation_status).to eq("failed")
    end

    # Pre-existing behavior, still covered: a Gemini call failure marks the
    # portfolio failed with a stored error, and re-raises for Sidekiq retry.
    it "marks the portfolio failed and re-raises when the Gemini call itself fails" do
      session = build_session_with_skills([
        { skill_id: "SK-1", skill_label: "React", state: "covered", probe_count: 3 },
      ])
      allow(fake_client).to receive(:generate_content)
        .and_raise(Gemini::HttpClient::TimeoutError.new("Gemini API timeout after 240s"))

      expect {
        described_class.new(session: session, gemini_client: fake_client).call
      }.to raise_error(Gemini::HttpClient::TimeoutError)

      expect(session.reload.portfolio.generation_status).to eq("failed")
      expect(session.portfolio.generation_error).to include("timeout")
    end
  end
end
