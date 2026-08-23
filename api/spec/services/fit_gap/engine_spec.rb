# frozen_string_literal: true

require "rails_helper"

RSpec.describe FitGap::Engine do
  let(:organization) { create(:organization) }
  let(:session)      { create(:session) }
  let(:portfolio)    { create(:portfolio, session: session) }
  let(:vacancy)      { create(:vacancy, tenant_id: organization.id) }
  let(:gemini_stub)  { Gemini::StubClient.new(mode: :valid) }

  subject(:engine) { described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: gemini_stub) }

  # Shared context: a vacancy with one skill and a matching portfolio skill.
  shared_context "with matched skill" do
    let!(:vs) { create(:vacancy_skill, vacancy: vacancy, skill_id: "SK-RUBY", skill_label: "Ruby", expected_level: 3) }
    let!(:ps) do
      create(:portfolio_skill, portfolio: portfolio, skill_id: "SK-RUBY", skill_label: "Ruby", ai_level: 3,
                               ai_confidence: "high")
    end
  end

  describe "schema_version" do
    include_context "with matched skill"

    it "attaches SCHEMA_VERSION to every comparison" do
      report = engine.call
      report.skill_comparisons.each do |c|
        expect(c["schema_version"]).to eq(FitGap::Engine::SCHEMA_VERSION)
      end
    end
  end

  # AC-1.1: vacancy skill present, high confidence, delta 0 → match
  describe "AC-1.1 — match verdict" do
    include_context "with matched skill"

    it "returns result: match with delta 0" do
      report = engine.call
      comp = report.skill_comparisons.first
      expect(comp["result"]).to eq("match")
      expect(comp["delta"]).to eq(0)
      expect(comp["candidate_level"]).to eq(3)
      expect(comp["expected_level"]).to eq(3)
    end
  end

  # AC-1.2: delta > 0 → exceed
  describe "AC-1.2 — exceed verdict" do
    let!(:vs) { create(:vacancy_skill, vacancy: vacancy, skill_id: "SK-RUBY", skill_label: "Ruby", expected_level: 2) }
    let!(:ps) do
      create(:portfolio_skill, portfolio: portfolio, skill_id: "SK-RUBY", skill_label: "Ruby", ai_level: 4,
                               ai_confidence: "high")
    end

    it "returns result: exceed with positive delta" do
      report = engine.call
      comp = report.skill_comparisons.first
      expect(comp["result"]).to eq("exceed")
      expect(comp["delta"]).to be > 0
    end
  end

  # AC-1.3: delta < 0 → gap
  describe "AC-1.3 — gap verdict" do
    let!(:vs) { create(:vacancy_skill, vacancy: vacancy, skill_id: "SK-RUBY", skill_label: "Ruby", expected_level: 4) }
    let!(:ps) do
      create(:portfolio_skill, portfolio: portfolio, skill_id: "SK-RUBY", skill_label: "Ruby", ai_level: 2,
                               ai_confidence: "high")
    end

    it "returns result: gap with negative delta" do
      report = engine.call
      comp = report.skill_comparisons.first
      expect(comp["result"]).to eq("gap")
      expect(comp["delta"]).to be < 0
    end
  end

  # AC-1.4: vacancy skill absent from portfolio → not_assessed, never gap
  describe "AC-1.4 — not_assessed for missing portfolio skill" do
    let!(:vs) { create(:vacancy_skill, vacancy: vacancy, skill_id: "SK-RUBY", skill_label: "Ruby", expected_level: 3) }
    # No portfolio_skill created.

    it "returns result: not_assessed with nil candidate_level and delta" do
      report = engine.call
      comp = report.skill_comparisons.first
      expect(comp["result"]).to eq("not_assessed")
      expect(comp["candidate_level"]).to be_nil
      expect(comp["delta"]).to be_nil
      expect(comp["expected_level"]).to eq(3)
    end
  end

  # AC-1.5: low confidence → insufficient_evidence
  describe "AC-1.5 — insufficient_evidence for low confidence" do
    let!(:vs) { create(:vacancy_skill, vacancy: vacancy, skill_id: "SK-RUBY", skill_label: "Ruby", expected_level: 3) }
    let!(:ps) do
      create(:portfolio_skill, portfolio: portfolio, skill_id: "SK-RUBY", skill_label: "Ruby", ai_level: 2,
                               ai_confidence: "low")
    end

    it "returns result: insufficient_evidence with delta computed but not asserted as gap" do
      report = engine.call
      comp = report.skill_comparisons.first
      expect(comp["result"]).to eq("insufficient_evidence")
      expect(comp["delta"]).to eq(-1)           # delta still computed
      expect(comp["candidate_level"]).to eq(2)  # level shown
      expect(comp["confidence"]).to eq("low")
    end
  end

  # AC-1.6: medium confidence → verdict returned (same as high, for now)
  describe "AC-1.6 — medium confidence returns a verdict" do
    let!(:vs) { create(:vacancy_skill, vacancy: vacancy, skill_id: "SK-RUBY", skill_label: "Ruby", expected_level: 3) }
    let!(:ps) do
      create(:portfolio_skill, portfolio: portfolio, skill_id: "SK-RUBY", skill_label: "Ruby", ai_level: 3,
                               ai_confidence: "medium")
    end

    it "returns match with medium confidence" do
      report = engine.call
      comp = report.skill_comparisons.first
      expect(comp["result"]).to eq("match")
      expect(comp["confidence"]).to eq("medium")
    end
  end

  # AC-1.7: assessed but unrated (ai_level nil) → not_assessed
  describe "AC-1.7 — unrated skill returns not_assessed" do
    let!(:vs) { create(:vacancy_skill, vacancy: vacancy, skill_id: "SK-RUBY", skill_label: "Ruby", expected_level: 3) }
    let!(:ps) do
      create(:portfolio_skill, portfolio: portfolio, skill_id: "SK-RUBY", skill_label: "Ruby", ai_level: nil,
                               ai_confidence: "high")
    end

    it "returns not_assessed, not gap" do
      report = engine.call
      comp = report.skill_comparisons.first
      expect(comp["result"]).to eq("not_assessed")
      expect(comp["candidate_level"]).to be_nil
      expect(comp["delta"]).to be_nil
    end
  end

  # AC-1.8: override present → effective_level = override, level_source: assessor
  describe "AC-1.8 — assessor override" do
    let!(:vs) { create(:vacancy_skill, vacancy: vacancy, skill_id: "SK-RUBY", skill_label: "Ruby", expected_level: 3) }
    let!(:ps) do
      create(:portfolio_skill, portfolio: portfolio, skill_id: "SK-RUBY", skill_label: "Ruby", ai_level: 2,
                               ai_confidence: "high")
    end
    let!(:ov) { create(:assessor_override, portfolio_skill: ps, ai_level: 2, override_level: 4) }

    it "uses override level and marks level_source and is_override" do
      report = engine.call
      comp = report.skill_comparisons.first
      expect(comp["effective_level"]).to eq(4)  # override level used
      expect(comp["ai_level"]).to eq(2)         # original ai_level retained
      expect(comp["level_source"]).to eq("assessor")
      expect(comp["is_override"]).to be true
      expect(comp["result"]).to eq("exceed")    # 4 - 3 = +1
    end
  end

  # AC-1.9: no override → level_source: ai, is_override: false
  describe "AC-1.9 — no override" do
    include_context "with matched skill"

    it "has level_source: ai and is_override: false" do
      report = engine.call
      comp = report.skill_comparisons.first
      expect(comp["level_source"]).to eq("ai")
      expect(comp["is_override"]).to be false
      expect(comp["ai_level"]).to eq(3)
      expect(comp["effective_level"]).to eq(3)
    end
  end

  # AC-1.10: portfolio skill not in vacancy → additional_strengths
  describe "AC-1.10 — additional strengths" do
    let!(:vs) { create(:vacancy_skill, vacancy: vacancy, skill_id: "SK-RUBY", skill_label: "Ruby", expected_level: 3) }
    let!(:ps_ruby) do
      create(:portfolio_skill, portfolio: portfolio, skill_id: "SK-RUBY", skill_label: "Ruby", ai_level: 3,
                               ai_confidence: "high")
    end
    let!(:ps_python) do
      create(:portfolio_skill, portfolio: portfolio, skill_id: "SK-PYTHON", skill_label: "Python", ai_level: 4,
                               ai_confidence: "high")
    end

    it "includes the extra skill in additional_strengths, not skill_comparisons" do
      report = engine.call
      labels = report.skill_comparisons.pluck("skill_label")
      expect(labels).to contain_exactly("Ruby")

      expect(report.additional_strengths.length).to eq(1)
      expect(report.additional_strengths.first["skill_label"]).to eq("Python")
      expect(report.additional_strengths.first["ai_level"]).to eq(4)
    end
  end

  # AC-1.11: vacancy with zero skills → empty comparisons
  describe "AC-1.11 — vacancy with zero skills" do
    it "returns empty skill_comparisons and a valid report" do
      report = engine.call
      expect(report.skill_comparisons).to be_empty
      expect(report).to be_persisted
    end
  end

  # AC-1.12: portfolio with zero skills → every vacancy skill is not_assessed
  describe "AC-1.12 — portfolio with zero skills" do
    let!(:vs) { create(:vacancy_skill, vacancy: vacancy, skill_id: "SK-RUBY", skill_label: "Ruby", expected_level: 3) }
    # No portfolio skills.

    it "marks every vacancy skill as not_assessed" do
      report = engine.call
      expect(report.skill_comparisons.length).to eq(1)
      expect(report.skill_comparisons.first["result"]).to eq("not_assessed")
    end
  end

  # AC-1.13: duplicate vacancy skill labels → both compared
  # OBSOLETE: db/migrate/20260819000005_add_uniqueness_and_fitgap_status.rb
  # later added a unique index on (vacancy_id, skill_label), so two vacancy
  # skills sharing a label on the same vacancy can no longer exist — this
  # scenario is now impossible to construct. Left pending rather than
  # deleted since it documents a real, deliberate behavior change.
  describe "AC-1.13 — duplicate vacancy skill labels", pending: "obsoleted by unique index on (vacancy_id, skill_label)" do
    # Two vacancy skills with same label but different skill_ids.
    let!(:vs1) { create(:vacancy_skill, vacancy: vacancy, skill_id: "SK-A", skill_label: "Ruby", expected_level: 3) }
    let!(:vs2) { create(:vacancy_skill, vacancy: vacancy, skill_id: "SK-B", skill_label: "Ruby", expected_level: 4) }
    let!(:ps1) do
      create(:portfolio_skill, portfolio: portfolio, skill_id: "SK-A", skill_label: "Ruby", ai_level: 3,
                               ai_confidence: "high")
    end
    let!(:ps2) do
      create(:portfolio_skill, portfolio: portfolio, skill_id: "SK-B", skill_label: "Ruby", ai_level: 4,
                               ai_confidence: "high")
    end

    it "produces two comparisons, one per vacancy skill" do
      report = engine.call
      expect(report.skill_comparisons.length).to eq(2)
      ids = report.skill_comparisons.pluck("skill_id")
      expect(ids).to contain_exactly("SK-A", "SK-B")
    end
  end

  # AC-1.14: vacancy skill with nil skill_id → matched by label
  describe "AC-1.14 — match by label when skill_id is nil" do
    let!(:vs) { create(:vacancy_skill, vacancy: vacancy, skill_id: nil, skill_label: "Ruby", expected_level: 3) }
    let!(:ps) do
      create(:portfolio_skill, portfolio: portfolio, skill_id: "SK-OTHER", skill_label: "Ruby", ai_level: 3,
                               ai_confidence: "high")
    end

    it "matches by case-insensitive label" do
      report = engine.call
      comp = report.skill_comparisons.first
      expect(comp["result"]).to eq("match")
    end
  end

  # AC-1.15: every emitted comparison carries all required fields
  describe "AC-1.15 — complete comparison payload" do
    include_context "with matched skill"

    let!(:ps_extra) do
      create(:portfolio_skill, portfolio: portfolio, skill_id: "SK-PYTHON", skill_label: "Python", ai_level: 4,
                               ai_confidence: "low")
    end

    it "includes all required fields in every comparison" do
      report = engine.call
      required_fields = %w[
        expected_level candidate_level ai_level effective_level
        level_source confidence is_override delta result schema_version
      ]

      report.skill_comparisons.each do |comp|
        required_fields.each do |field|
          expect(comp).to have_key(field), "missing #{field} in comparison: #{comp.inspect}"
        end
      end

      report.additional_strengths.each do |str|
        %w[skill_label skill_id ai_level effective_level level_source confidence is_override
           schema_version].each do |field|
          expect(str).to have_key(field), "missing #{field} in additional_strength: #{str.inspect}"
        end
      end
    end
  end

  describe "#call — report persistence" do
    include_context "with matched skill"

    it "creates a FitGapReport record" do
      expect { engine.call }.to change(FitGapReport, :count).by(1)
    end

    it "stores skill_comparisons and narratives" do
      # The shared :valid Gemini fixture is shaped for Portfolios::Generator
      # (configured_skills/discovered_skills), not this engine's narrative
      # output — stub the shape it actually expects.
      allow(gemini_stub).to receive(:generate_content).and_return(
        "culture_narrative" => "Strong alignment with the team's technical culture.",
        "overall_narrative" => "A solid match overall."
      )

      report = engine.call
      expect(report.skill_comparisons).to be_an(Array)
      expect(report.culture_narrative).to be_present
      expect(report.generated_at).to be_present
    end

    it "is idempotent — re-running updates the existing report" do
      first = engine.call
      second = engine.call
      expect(first.id).to eq(second.id)
    end

    it "sets narrative_source to 'ai' when Gemini call succeeds" do
      allow(gemini_stub).to receive(:generate_content).and_return(
        "culture_narrative" => "Strong cultural alignment.",
        "overall_narrative" => "Recommended hire."
      )

      report = engine.call
      expect(report.narrative_source).to eq("ai")
      expect(report.generation_error).to be_nil
    end

    it "sets narrative_source to 'fallback' and populates generation_error when Gemini call raises" do
      allow(gemini_stub).to receive(:generate_content).and_raise(StandardError, "quota exceeded")

      report = engine.call
      expect(report.narrative_source).to eq("fallback")
      expect(report.generation_error).to eq("quota exceeded")
      expect(report.overall_narrative).to be_present
    end

    it "sets status to 'complete' on success" do
      allow(gemini_stub).to receive(:generate_content).and_return(
        "culture_narrative" => "Culture fit.",
        "overall_narrative" => "Hire."
      )

      report = engine.call
      expect(report.status).to eq("complete")
    end
  end
end
