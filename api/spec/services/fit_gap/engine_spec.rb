# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGap::Engine, type: :service do
  let(:assessment) { create(:assessment) }
  let(:session) { create(:session, assessment: assessment, status: 'ended') }
  let(:portfolio) { create(:portfolio, session: session) }
  let(:vacancy) { create(:vacancy, tenant_id: 1) }
  let(:gemini) { double('gemini') }

  before do
    create(:vacancy_skill, vacancy: vacancy, skill_id: 'SK-001', skill_label: 'React', expected_level: 3)
  end

  def build_portfolio_skill(ai_level:, provenance: [{ 'verified' => true }])
    create(:portfolio_skill, portfolio: portfolio, skill_id: 'SK-001', skill_label: 'React',
                             ai_level: ai_level, ai_confidence: 'medium', evidence_provenance: provenance)
  end

  describe 'review-aware comparisons' do
    it 'uses the AI level when confirmed' do
      skill = build_portfolio_skill(ai_level: 3)
      create(:assessor_override, portfolio_skill: skill, outcome: 'confirmed', ai_level: 3, reviewed_level: nil, rationale: 'x')
      allow(gemini).to receive(:generate_content).and_return({ 'culture_narrative' => 'c', 'overall_narrative' => 'o' })

      report = FitGap::Engine.new(portfolio: portfolio, vacancy: vacancy, gemini_client: gemini).call
      cmp = report.skill_comparisons.first
      expect(cmp['candidate_level']).to eq(3)
      expect(cmp['result']).to eq('match')
      expect(cmp['level_source']).to eq('ai_confirmed')
    end

    it 'uses the reviewed level when adjusted' do
      skill = build_portfolio_skill(ai_level: 2)
      create(:assessor_override, portfolio_skill: skill, outcome: 'adjusted', ai_level: 2, reviewed_level: 4, rationale: 'x')
      allow(gemini).to receive(:generate_content).and_return({ 'culture_narrative' => 'c', 'overall_narrative' => 'o' })

      report = FitGap::Engine.new(portfolio: portfolio, vacancy: vacancy, gemini_client: gemini).call
      cmp = report.skill_comparisons.first
      expect(cmp['candidate_level']).to eq(4)
      expect(cmp['result']).to eq('exceed')
      expect(cmp['level_source']).to eq('human_adjusted')
    end

    it 'maps insufficient evidence to not_assessed, never a gap' do
      skill = build_portfolio_skill(ai_level: 3)
      create(:assessor_override, portfolio_skill: skill, outcome: 'insufficient_evidence', ai_level: 3,
                                 reviewed_level: nil, rationale: 'No signal')
      allow(gemini).to receive(:generate_content).and_return({ 'culture_narrative' => 'c', 'overall_narrative' => 'o' })

      report = FitGap::Engine.new(portfolio: portfolio, vacancy: vacancy, gemini_client: gemini).call
      cmp = report.skill_comparisons.first
      expect(cmp['candidate_level']).to be_nil
      expect(cmp['result']).to eq('not_assessed')
    end

    it 'maps missing/invalid AI levels to not_assessed' do
      build_portfolio_skill(ai_level: nil)
      allow(gemini).to receive(:generate_content).and_return({ 'culture_narrative' => 'c', 'overall_narrative' => 'o' })

      report = FitGap::Engine.new(portfolio: portfolio, vacancy: vacancy, gemini_client: gemini).call
      cmp = report.skill_comparisons.first
      expect(cmp['result']).to eq('not_assessed')
    end
  end

  describe 'lifecycle' do
    it 'persists comparisons before narrative generation' do
      build_portfolio_skill(ai_level: 3)
      allow(gemini).to receive(:generate_content).and_raise(FitGap::Engine::NarrativeGenerationError, 'boom')

      expect do
        FitGap::Engine.new(portfolio: portfolio, vacancy: vacancy, gemini_client: gemini).call
      end.to raise_error(FitGap::Engine::NarrativeGenerationError)

      report = FitGapReport.find_by(portfolio: portfolio, vacancy: vacancy)
      expect(report.generation_status).to eq('generating')
      expect(report.skill_comparisons).not_to be_empty
    end

    it 'marks complete with narratives on success' do
      build_portfolio_skill(ai_level: 3)
      allow(gemini).to receive(:generate_content).and_return({ 'culture_narrative' => 'c', 'overall_narrative' => 'o' })

      report = FitGap::Engine.new(portfolio: portfolio, vacancy: vacancy, gemini_client: gemini).call
      expect(report.generation_status).to eq('complete')
      expect(report.culture_narrative).to eq('c')
      expect(report.overall_narrative).to eq('o')
    end
  end
end
