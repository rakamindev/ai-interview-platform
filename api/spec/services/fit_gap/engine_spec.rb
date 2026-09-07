# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGap::Engine do
  let(:assessment) { create(:assessment, :with_prd02_skills) }
  let(:session)    { create(:session, :ended, assessment: assessment) }
  let(:portfolio)  { create(:portfolio, session: session) }
  let(:vacancy)    { create(:vacancy) }
  let(:client)     { instance_double(Gemini::HttpClient) }

  subject(:engine) { described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: client) }

  before do
    allow(client).to receive(:generate_content).and_return(
      { 'culture_narrative' => 'Aligns with an async-first culture.',
        'overall_narrative' => 'Worth a hiring conversation.' }
    )
  end

  def candidate_has(label, level, confidence: 'medium')
    create(:portfolio_skill, portfolio: portfolio, skill_label: label,
                             ai_level: level, ai_confidence: confidence)
  end

  def vacancy_wants(label, level)
    create(:vacancy_skill, vacancy: vacancy, skill_label: label, expected_level: level)
  end

  def comparison_for(report, label)
    report.skill_comparisons.map(&:symbolize_keys).find { |c| c[:skill_label] == label }
  end

  describe 'comparing a candidate against a role' do
    it 'calls it a match when the levels agree' do
      candidate_has('Communication', 3)
      vacancy_wants('Communication', 3)

      expect(comparison_for(engine.call, 'Communication')).to include(result: 'match', delta: 0)
    end

    it 'calls it a gap when the candidate is below the requirement' do
      candidate_has('Communication', 2)
      vacancy_wants('Communication', 3)

      expect(comparison_for(engine.call, 'Communication')).to include(result: 'gap', delta: -1)
    end

    it 'calls it an exceed when the candidate is above it' do
      candidate_has('System Design', 3)
      vacancy_wants('System Design', 2)

      expect(comparison_for(engine.call, 'System Design')).to include(result: 'exceed', delta: 1)
    end

    it 'reports a skill the interview never reached as not assessed' do
      vacancy_wants('Security Engineering', 3)

      expect(comparison_for(engine.call, 'Security Engineering'))
        .to include(result: 'not_assessed', candidate_level: nil, delta: nil)
    end
  end

  # The assessor's correction is the product's human-in-the-loop mechanism, and
  # the whole point of the fit/gap table is to act on it. It must both win over
  # the model's reading and be visible as a human decision rather than a machine
  # one — `is_override` was computed and then never sent, so the table's pencil
  # marker could never appear.
  describe 'when an assessor has overridden the model' do
    let!(:skill) { candidate_has('React / Frontend Development Core', 4) }

    before do
      create(:assessor_override, portfolio_skill: skill, ai_level: 4, override_level: 3)
      vacancy_wants('React / Frontend Development Core', 3)
    end

    it 'compares against the human level, not the model level' do
      comparison = comparison_for(engine.call, 'React / Frontend Development Core')

      expect(comparison[:candidate_level]).to eq(3)
      expect(comparison[:result]).to eq('match')
    end

    it 'marks the row as carrying a human decision' do
      expect(comparison_for(engine.call, 'React / Frontend Development Core')[:is_override]).to be true
    end

    it 'leaves untouched rows unmarked' do
      candidate_has('Communication', 3)
      vacancy_wants('Communication', 3)

      expect(comparison_for(engine.call, 'Communication')[:is_override]).to be false
    end
  end

  describe 'matching a vacancy skill to a portfolio skill' do
    it 'matches on label regardless of case' do
      candidate_has('Communication', 3)
      vacancy_wants('communication', 3)

      expect(comparison_for(engine.call, 'communication')[:result]).to eq('match')
    end

    # Recorded rather than fixed. Every assessment created through the UI stores
    # skill_id as nil, so matching falls back to comparing label strings — and a
    # vacancy that spells a skill the way the B7 taxonomy does ("System Design &
    # Architecture") will not find a portfolio that stored it as the assessor
    # typed it ("System Design"). The candidate was assessed, and scored above
    # the requirement, but the report says `not_assessed`, which reads exactly
    # like never having been asked.
    it 'fails to match when the same skill is spelled differently' do
      candidate_has('System Design', 3)
      vacancy_wants('System Design & Architecture', 2)

      expect(comparison_for(engine.call, 'System Design & Architecture')[:result]).to eq('not_assessed')
    end
  end

  describe 'when the narrative model call fails' do
    before { allow(client).to receive(:generate_content).and_raise(StandardError, 'API returned 503') }

    it 'still produces the rule-based comparison' do
      candidate_has('Communication', 2)
      vacancy_wants('Communication', 3)

      expect(comparison_for(engine.call, 'Communication')[:result]).to eq('gap')
    end

    it 'falls back to a factual summary rather than inventing a narrative' do
      candidate_has('Communication', 2)
      vacancy_wants('Communication', 3)
      report = engine.call

      expect(report.culture_narrative).to be_nil
      expect(report.overall_narrative).to include('1 gaps')
    end
  end

  describe 'persistence' do
    it 'upserts rather than duplicating a report for the same pairing' do
      candidate_has('Communication', 3)
      vacancy_wants('Communication', 3)

      first = engine.call
      again = described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: client).call

      expect(again.id).to eq(first.id)
      expect(FitGapReport.where(portfolio_id: portfolio.id, vacancy_id: vacancy.id).count).to eq(1)
    end
  end
end
