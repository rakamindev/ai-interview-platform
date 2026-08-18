# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGap::Engine, type: :service do
  let(:portfolio) { create(:portfolio) }
  let(:vacancy) { create(:vacancy) }

  # Mock Gemini client so tests don't make real API calls
  let(:mock_gemini) do
    double('Gemini::HttpClient', generate_content: {
      'culture_narrative' => 'Candidate exhibits high cultural alignment.',
      'overall_narrative' => 'Recommended for hire.'
    })
  end

  subject { described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: mock_gemini) }

  describe '#call' do
    context 'when candidate skill matches vacancy requirement' do
      before do
        create(:portfolio_skill, portfolio: portfolio, skill_id: 'SK-ENG-001', skill_label: 'React', ai_level: 3)
        create(:vacancy_skill, vacancy: vacancy, skill_id: 'SK-ENG-001', skill_label: 'React', expected_level: 3)
      end

      it 'returns match result with zero delta' do
        report = subject.call
        comparison = report.skill_comparisons.find { |c| c['skill_id'] == 'SK-ENG-001' }

        expect(comparison['result']).to eq('match')
        expect(comparison['delta']).to eq(0)
        expect(comparison['candidate_level']).to eq(3)
        expect(comparison['expected_level']).to eq(3)
      end
    end

    context 'when candidate skill exceeds vacancy requirement' do
      before do
        create(:portfolio_skill, portfolio: portfolio, skill_id: 'SK-ENG-001', skill_label: 'React', ai_level: 5)
        create(:vacancy_skill, vacancy: vacancy, skill_id: 'SK-ENG-001', skill_label: 'React', expected_level: 3)
      end

      it 'returns exceed result with positive delta' do
        report = subject.call
        comparison = report.skill_comparisons.find { |c| c['skill_id'] == 'SK-ENG-001' }

        expect(comparison['result']).to eq('exceed')
        expect(comparison['delta']).to eq(2)
      end
    end

    context 'when candidate skill has a gap' do
      before do
        create(:portfolio_skill, portfolio: portfolio, skill_id: 'SK-ENG-001', skill_label: 'React', ai_level: 2)
        create(:vacancy_skill, vacancy: vacancy, skill_id: 'SK-ENG-001', skill_label: 'React', expected_level: 4)
      end

      it 'returns gap result with negative delta' do
        report = subject.call
        comparison = report.skill_comparisons.find { |c| c['skill_id'] == 'SK-ENG-001' }

        expect(comparison['result']).to eq('gap')
        expect(comparison['delta']).to eq(-2)
      end
    end

    context 'when skill is required by vacancy but NOT assessed in portfolio' do
      before do
        create(:vacancy_skill, vacancy: vacancy, skill_id: 'SK-ENG-002', skill_label: 'Node.js', expected_level: 4)
      end

      it 'returns not_assessed result with nil candidate_level and nil delta without crashing' do
        report = subject.call
        comparison = report.skill_comparisons.find { |c| c['skill_id'] == 'SK-ENG-002' }

        expect(comparison['result']).to eq('not_assessed')
        expect(comparison['candidate_level']).to be_nil
        expect(comparison['delta']).to be_nil
        expect(comparison['expected_level']).to eq(4)
      end
    end

    context 'when assessor override is present' do
      let!(:portfolio_skill) do
        create(:portfolio_skill, portfolio: portfolio, skill_id: 'SK-ENG-001', skill_label: 'React', ai_level: 2)
      end
      let!(:vacancy_skill) do
        create(:vacancy_skill, vacancy: vacancy, skill_id: 'SK-ENG-001', skill_label: 'React', expected_level: 4)
      end
      let!(:override) do
        AssessorOverride.create!(
          portfolio_skill: portfolio_skill,
          ai_level: 2,
          override_level: 4,
          overridden_by: 1,
          assessor_notes: 'Demonstrated L4 during live coding assessment.'
        )
      end

      it 'uses the override level for calculation instead of raw AI level' do
        report = subject.call
        comparison = report.skill_comparisons.find { |c| c['skill_id'] == 'SK-ENG-001' }

        expect(comparison['candidate_level']).to eq(4)
        expect(comparison['result']).to eq('match')
        expect(comparison['delta']).to eq(0)
      end
    end
  end
end
