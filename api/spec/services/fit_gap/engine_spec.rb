# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGap::Engine do
  let(:organization) { create(:organization) }
  let(:session)      { create(:session, organization: organization) }
  let(:portfolio)    { create(:portfolio, session: session) }
  let(:vacancy)      { create(:vacancy, organization: organization) }

  let(:gemini_client) { instance_double(Gemini::HttpClient) }
  let(:narratives) do
    { 'culture_narrative' => 'Good culture fit.', 'overall_narrative' => 'Hire.' }
  end

  subject(:engine) { described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: gemini_client) }

  before do
    allow(gemini_client).to receive(:generate_content).and_return(narratives)
  end

  def comparison_for(report, label)
    report.skill_comparisons.map(&:with_indifferent_access).find { |c| c[:skill_label] == label }
  end

  describe '#call' do
    context 'skill level comparison' do
      before do
        create(:vacancy_skill, vacancy: vacancy, skill_id: 's-ruby',  skill_label: 'Ruby',  expected_level: 3)
        create(:vacancy_skill, vacancy: vacancy, skill_id: 's-sql',   skill_label: 'SQL',   expected_level: 4)
        create(:vacancy_skill, vacancy: vacancy, skill_id: 's-react', skill_label: 'React', expected_level: 2)
        create(:vacancy_skill, vacancy: vacancy, skill_id: 's-go',    skill_label: 'Go',    expected_level: 3)

        create(:portfolio_skill, portfolio: portfolio, skill_id: 's-ruby',  skill_label: 'Ruby',  ai_level: 3, ai_confidence: 'high')
        create(:portfolio_skill, portfolio: portfolio, skill_id: 's-sql',   skill_label: 'SQL',   ai_level: 2, ai_confidence: 'medium')
        create(:portfolio_skill, portfolio: portfolio, skill_id: 's-react', skill_label: 'React', ai_level: 4, ai_confidence: 'low')
        # Go: never assessed
      end

      it 'classifies match, gap, exceed, and not_assessed with correct deltas' do
        report = engine.call

        expect(comparison_for(report, 'Ruby')).to include('result' => 'match', 'delta' => 0)
        expect(comparison_for(report, 'SQL')).to include('result' => 'gap', 'delta' => -2)
        expect(comparison_for(report, 'React')).to include('result' => 'exceed', 'delta' => 2)
        expect(comparison_for(report, 'Go')).to include('result' => 'not_assessed', 'delta' => nil, 'candidate_level' => nil)
      end

      it 'emits the frontend contract keys: required_level, is_override, confidence' do
        report = engine.call
        ruby = comparison_for(report, 'Ruby')

        expect(ruby['required_level']).to eq(3)
        expect(ruby['is_override']).to eq(false)
        expect(ruby['confidence']).to eq('high')
        expect(ruby).not_to have_key('expected_level')
      end
    end

    context 'with an assessor override' do
      before do
        create(:vacancy_skill, vacancy: vacancy, skill_id: 's-ruby', skill_label: 'Ruby', expected_level: 4)
        skill = create(:portfolio_skill, portfolio: portfolio, skill_id: 's-ruby', skill_label: 'Ruby', ai_level: 2)
        create(:assessor_override, portfolio_skill: skill, ai_level: 2, override_level: 4)
      end

      it 'uses the override level and flags is_override' do
        report = engine.call
        ruby = comparison_for(report, 'Ruby')

        expect(ruby).to include('candidate_level' => 4, 'result' => 'match', 'is_override' => true)
      end
    end

    context 'skill matching by label when skill_id missing' do
      before do
        create(:vacancy_skill, vacancy: vacancy, skill_id: nil, skill_label: 'Ruby', expected_level: 3)
        create(:portfolio_skill, portfolio: portfolio, skill_id: nil, skill_label: 'ruby', ai_level: 3)
      end

      it 'falls back to case-insensitive label match' do
        report = engine.call
        expect(comparison_for(report, 'Ruby')['result']).to eq('match')
      end
    end

    context 'when Gemini narrative generation fails' do
      before do
        create(:vacancy_skill, vacancy: vacancy, skill_label: 'Ruby', expected_level: 3)
        allow(gemini_client).to receive(:generate_content).and_raise(StandardError, 'timeout')
      end

      it 'stores nil culture narrative and a computed fallback overall narrative' do
        report = engine.call

        expect(report.culture_narrative).to be_nil
        expect(report.overall_narrative).to include('gaps against role requirements')
      end
    end

    context 'idempotency' do
      before do
        create(:vacancy_skill, vacancy: vacancy, skill_label: 'Ruby', expected_level: 3)
      end

      it 'updates the existing report instead of creating a duplicate' do
        first  = engine.call
        second = described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: gemini_client).call

        expect(second.id).to eq(first.id)
        expect(FitGapReport.where(portfolio_id: portfolio.id, vacancy_id: vacancy.id).count).to eq(1)
      end
    end
  end
end