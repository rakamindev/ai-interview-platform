# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGap::Engine do
  let(:assessment) { create(:assessment) }
  let(:session) { create(:session, assessment: assessment) }
  let(:portfolio) { create(:portfolio, session: session) }
  let(:vacancy) { create(:vacancy) }

  let(:mock_gemini_client) do
    instance_double(
      Gemini::HttpClient,
      generate_content: {
        'culture_narrative' => 'Strong autonomous mindset aligned with company values.',
        'overall_narrative' => 'Recommended for senior hiring track based on demonstrated capabilities.'
      }
    )
  end

  subject(:engine) { described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: mock_gemini_client) }

  describe '#call' do
    context 'when skills match perfectly' do
      before do
        create(:portfolio_skill, portfolio: portfolio, skill_label: 'Ruby on Rails', ai_level: 3)
      end

      it 'calculates match result and zero delta' do
        report = engine.call
        comparison = report.skill_comparisons.find { |c| c['skill_label'] == 'Ruby on Rails' }

        expect(comparison).not_to be_nil
        expect(comparison['result']).to eq('match')
        expect(comparison['delta']).to eq(0)
        expect(comparison['candidate_level']).to eq(3)
        expect(comparison['expected_level']).to eq(3)
        expect(comparison['required_level']).to eq(3)
        expect(comparison['is_override']).to be false
      end
    end

    context 'when candidate level exceeds requirement' do
      before do
        create(:portfolio_skill, portfolio: portfolio, skill_label: 'Ruby on Rails', ai_level: 5)
      end

      it 'calculates exceed result with positive delta' do
        report = engine.call
        comparison = report.skill_comparisons.find { |c| c['skill_label'] == 'Ruby on Rails' }

        expect(comparison['result']).to eq('exceed')
        expect(comparison['delta']).to eq(2)
        expect(comparison['candidate_level']).to eq(5)
        expect(comparison['expected_level']).to eq(3)
      end
    end

    context 'when candidate level has a gap against requirement' do
      before do
        create(:portfolio_skill, portfolio: portfolio, skill_label: 'Ruby on Rails', ai_level: 1)
      end

      it 'calculates gap result with negative delta' do
        report = engine.call
        comparison = report.skill_comparisons.find { |c| c['skill_label'] == 'Ruby on Rails' }

        expect(comparison['result']).to eq('gap')
        expect(comparison['delta']).to eq(-2)
        expect(comparison['candidate_level']).to eq(1)
      end
    end

    context 'when skill was not assessed' do
      it 'marks skill as not_assessed with nil candidate level' do
        report = engine.call
        comparison = report.skill_comparisons.find { |c| c['skill_label'] == 'System Design' }

        expect(comparison['result']).to eq('not_assessed')
        expect(comparison['candidate_level']).to be_nil
        expect(comparison['delta']).to be_nil
        expect(comparison['expected_level']).to eq(4)
      end
    end

    context 'when configured skill was not probed during interview' do
      before do
        create(
          :portfolio_skill,
          portfolio: portfolio,
          skill_label: 'Ruby on Rails',
          ai_level: 1,
          ai_confidence: 'low',
          evidence: [],
          competency_summary: 'Skill was configured in the assessment but was not probed or evaluated during the interview.'
        )
      end

      it 'treats unprobed skill as not_assessed instead of falsely rating as gap' do
        report = engine.call
        comparison = report.skill_comparisons.find { |c| c['skill_label'] == 'Ruby on Rails' }

        expect(comparison['result']).to eq('not_assessed')
        expect(comparison['candidate_level']).to be_nil
        expect(comparison['delta']).to be_nil
      end
    end

    context 'when assessor has overridden the AI rating (BUG-02 verification)' do
      let!(:skill) { create(:portfolio_skill, portfolio: portfolio, skill_label: 'Ruby on Rails', ai_level: 2) }
      let!(:override) { create(:assessor_override, portfolio_skill: skill, ai_level: 2, override_level: 4) }

      it 'applies the overridden level as effective_level and flags is_override: true' do
        report = engine.call
        comparison = report.skill_comparisons.find { |c| c['skill_label'] == 'Ruby on Rails' }

        expect(comparison['candidate_level']).to eq(4)
        expect(comparison['result']).to eq('exceed') # 4 vs required 3
        expect(comparison['is_override']).to be true
      end
    end

    context 'when Gemini API call fails' do
      before do
        allow(mock_gemini_client).to receive(:generate_content).and_raise(StandardError.new('Gemini timeout'))
        create(:portfolio_skill, portfolio: portfolio, skill_label: 'Ruby on Rails', ai_level: 3)
      end

      it 'falls back gracefully to synthetic summary without raising' do
        expect { engine.call }.not_to raise_error
        report = FitGapReport.find_by(portfolio: portfolio, vacancy: vacancy)
        expect(report.culture_narrative).to be_nil
        expect(report.overall_narrative).to include('Candidate shows')
      end
    end
  end
end
