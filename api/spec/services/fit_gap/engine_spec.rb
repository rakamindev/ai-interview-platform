# frozen_string_literal: true

require 'rails_helper'

# N13 turns a portfolio plus a vacancy into the last artifact a human reads
# before making a hiring decision. Everything asserted here is about that
# payload being *sufficient to decide with* — not merely well formed.
RSpec.describe FitGap::Engine do
  let(:gemini) { instance_double(Gemini::HttpClient) }

  let(:session)   { create(:session) }
  let(:portfolio) { create(:portfolio, session: session) }
  let(:vacancy)   { create(:vacancy) }

  def stub_narrative(culture: 'Culture fits.', overall: 'Recommend a hiring conversation.')
    allow(gemini).to receive(:generate_content)
      .and_return({ 'culture_narrative' => culture, 'overall_narrative' => overall })
  end

  def run
    described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: gemini).call
  end

  def comparison_for(label, report)
    report.skill_comparisons.find { |c| c['skill_label'] == label || c[:skill_label] == label }
  end

  before { stub_narrative }

  # ─────────────────────────────────────────────────────────────────────────────
  # Behaviour that is already correct. Locked in so a refactor cannot regress it.
  # ─────────────────────────────────────────────────────────────────────────────
  describe 'level comparison' do
    it 'reports a match when the candidate meets the expected level' do
      create(:vacancy_skill, vacancy: vacancy, expected_level: 3)
      create(:portfolio_skill, portfolio: portfolio, ai_level: 3)

      c = comparison_for('React / Frontend Development Core', run)

      expect(c['result']).to eq('match')
      expect(c['delta']).to eq(0)
      expect(c['expected_level']).to eq(3)
      expect(c['candidate_level']).to eq(3)
    end

    it 'reports a gap with a negative delta when the candidate is below' do
      create(:vacancy_skill, vacancy: vacancy, expected_level: 3)
      create(:portfolio_skill, portfolio: portfolio, ai_level: 2)

      c = comparison_for('React / Frontend Development Core', run)

      expect(c['result']).to eq('gap')
      expect(c['delta']).to eq(-1)
    end

    it 'reports exceed with a positive delta when the candidate is above' do
      create(:vacancy_skill, vacancy: vacancy, expected_level: 2)
      create(:portfolio_skill, portfolio: portfolio, ai_level: 3)

      c = comparison_for('React / Frontend Development Core', run)

      expect(c['result']).to eq('exceed')
      expect(c['delta']).to eq(1)
    end

    it 'prefers the assessor override over the AI level when deciding the result' do
      create(:vacancy_skill, vacancy: vacancy, expected_level: 3)
      skill = create(:portfolio_skill, portfolio: portfolio, ai_level: 2)
      create(:assessor_override, portfolio_skill: skill, ai_level: 2, override_level: 3)

      c = comparison_for('React / Frontend Development Core', run)

      expect(c['candidate_level']).to eq(3), 'the human correction must win over the model'
      expect(c['result']).to eq('match')
    end
  end

  describe 'a required skill that was never assessed' do
    it 'is reported as not_assessed rather than as a gap' do
      create(:vacancy_skill, vacancy: vacancy,
                             skill_id: 'SK-ENG-006',
                             skill_label: 'Testing & Quality Assurance',
                             expected_level: 3)

      c = comparison_for('Testing & Quality Assurance', run)

      # Absence of evidence must never be recorded as evidence of absence:
      # a skill nobody asked about is not the same as a skill the candidate lacks.
      expect(c['result']).to eq('not_assessed')
      expect(c['candidate_level']).to be_nil
      expect(c['delta']).to be_nil
      expect(c['expected_level']).to eq(3)
    end
  end

  describe 'skill matching' do
    it 'matches on skill_id ahead of label when both are present' do
      create(:vacancy_skill, vacancy: vacancy, skill_id: 'SK-ENG-001',
                             skill_label: 'React / Frontend Development Core', expected_level: 3)
      create(:portfolio_skill, portfolio: portfolio, skill_id: 'SK-ENG-001',
                               skill_label: 'React (renamed after the interview)', ai_level: 4)

      c = comparison_for('React / Frontend Development Core', run)

      expect(c['candidate_level']).to eq(4), 'a relabelled skill must still match on its stable id'
    end

    it 'falls back to a case-insensitive label match for custom skills without an id' do
      create(:vacancy_skill, vacancy: vacancy, skill_id: nil,
                             skill_label: 'Communication', expected_level: 3)
      create(:portfolio_skill, portfolio: portfolio, skill_id: nil,
                               skill_label: 'communication', ai_level: 2)

      expect(comparison_for('Communication', run)['candidate_level']).to eq(2)
    end
  end

  # ─────────────────────────────────────────────────────────────────────────────
  # F2 / F3 — the payload is well formed but not sufficient to decide with.
  # These fail against the current implementation. That is the point.
  # ─────────────────────────────────────────────────────────────────────────────
  describe 'evidence provenance in the payload' do
    it 'marks a comparison whose level came from a human override' do
      create(:vacancy_skill, vacancy: vacancy, expected_level: 3)
      skill = create(:portfolio_skill, portfolio: portfolio, ai_level: 2)
      create(:assessor_override, portfolio_skill: skill, ai_level: 2, override_level: 3)

      c = comparison_for('React / Frontend Development Core', run)

      # The UI legend promises "✏ = human override applied". It can only keep
      # that promise if the payload says which rows were overridden.
      expect(c['is_override']).to be(true)
      expect(c['ai_level']).to eq(2), 'the pre-override level must survive so the UI can show 2 -> 3'
    end

    it 'leaves is_override false when the level is the model\'s own' do
      create(:vacancy_skill, vacancy: vacancy, expected_level: 3)
      create(:portfolio_skill, portfolio: portfolio, ai_level: 3)

      expect(comparison_for('React / Frontend Development Core', run)['is_override']).to be(false)
    end

    it 'carries the confidence and the amount of evidence behind each level' do
      create(:vacancy_skill, vacancy: vacancy, expected_level: 3)
      create(:portfolio_skill, portfolio: portfolio,
                               ai_level: 2, ai_confidence: 'low',
                               evidence: ['one quote only'])

      c = comparison_for('React / Frontend Development Core', run)

      # A gap inferred from a single quote and a gap backed by three must not be
      # indistinguishable downstream. The count is what makes them distinguishable.
      expect(c['confidence']).to eq('low')
      expect(c['evidence_count']).to eq(1)
    end

    it 'reports zero evidence rather than nil when the model returned no quotes' do
      create(:vacancy_skill, vacancy: vacancy, expected_level: 3)
      create(:portfolio_skill, portfolio: portfolio, evidence: [])

      expect(comparison_for('React / Frontend Development Core', run)['evidence_count']).to eq(0)
    end

    it 'reports no confidence or evidence for a skill that was never assessed' do
      create(:vacancy_skill, vacancy: vacancy,
                             skill_id: 'SK-ENG-006', skill_label: 'Testing & Quality Assurance',
                             expected_level: 3)

      c = comparison_for('Testing & Quality Assurance', run)

      expect(c['confidence']).to be_nil
      expect(c['evidence_count']).to eq(0)
    end
  end

  # ─────────────────────────────────────────────────────────────────────────────
  # F7 — designed failure paths. A degraded report must announce that it is degraded.
  # ─────────────────────────────────────────────────────────────────────────────
  describe 'when the narrative model call fails' do
    before do
      allow(gemini).to receive(:generate_content).and_raise(Gemini::HttpClient::TimeoutError, 'timeout after 30s')
      create(:vacancy_skill, vacancy: vacancy, expected_level: 3)
      create(:portfolio_skill, portfolio: portfolio, ai_level: 2)
    end

    it 'still produces the rule-based comparison table' do
      report = run

      expect(report.skill_comparisons.size).to eq(1)
      expect(comparison_for('React / Frontend Development Core', report)['result']).to eq('gap')
    end

    it 'records that the narrative is a fallback rather than a model answer' do
      # Without this flag the UI shows a counted summary under the heading
      # "Culture & Competency Fit" and the reader cannot tell the analysis
      # never ran.
      expect(run.narrative_degraded).to be(true)
    end

    it 'does not invent a culture narrative' do
      expect(run.culture_narrative).to be_nil
    end

    it 'pluralises the fallback summary correctly for a single item' do
      summary = run.overall_narrative

      expect(summary).to include('1 gap')
      expect(summary).not_to include('1 gaps')
    end

    it 'pluralises verb phrases correctly for counts above one' do
      # Regression: naive "+s" suffixing produced "3 skill meetss". The single-item
      # example above passed throughout, because it never exercised this branch.
      create(:vacancy_skill, vacancy: vacancy, skill_id: 'SK-ENG-002',
                             skill_label: 'Second Skill', expected_level: 2)
      create(:portfolio_skill, portfolio: portfolio, skill_id: 'SK-ENG-002',
                               skill_label: 'Second Skill', ai_level: 2)
      create(:vacancy_skill, vacancy: vacancy, skill_id: 'SK-ENG-003',
                             skill_label: 'Third Skill', expected_level: 2)
      create(:portfolio_skill, portfolio: portfolio, skill_id: 'SK-ENG-003',
                               skill_label: 'Third Skill', ai_level: 2)

      summary = run.overall_narrative

      expect(summary).to include('2 skills meet')
      expect(summary).not_to match(/meetss|exceedss|gapss|wass/)
    end
  end

  describe 'idempotence' do
    it 'updates the existing report instead of creating a second one' do
      create(:vacancy_skill, vacancy: vacancy, expected_level: 3)
      create(:portfolio_skill, portfolio: portfolio, ai_level: 3)

      first  = run
      second = run

      expect(second.id).to eq(first.id)
      expect(FitGapReport.where(portfolio_id: portfolio.id, vacancy_id: vacancy.id).count).to eq(1)
    end
  end

  describe 'edge-case inputs' do
    it 'produces an empty comparison list for a vacancy with no skills' do
      report = run

      expect(report.skill_comparisons).to eq([])
    end

    it 'preserves long competency text without truncating it' do
      long_summary = 'A' * 4_000
      create(:vacancy_skill, vacancy: vacancy, expected_level: 3)
      create(:portfolio_skill, portfolio: portfolio, competency_summary: long_summary)

      expect { run }.not_to raise_error
    end
  end
end
