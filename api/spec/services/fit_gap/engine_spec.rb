# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGap::Engine do
  let(:assessment) { create(:assessment) }
  let(:session) { create(:session, assessment: assessment) }
  let(:portfolio) { create(:portfolio, session: session) }
  let(:vacancy) { create(:vacancy, role_title: 'Senior Developer') }
  let(:gemini_client) { instance_double('Gemini::HttpClient') }
  let(:engine) { described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: gemini_client) }

  before do
    allow(Gemini::HttpClient).to receive(:new).and_return(gemini_client)
    allow(gemini_client).to receive(:generate_content).and_return({
      'culture_narrative' => 'Excellent culture fit.',
      'overall_narrative' => 'Highly recommended for hire.'
    }.to_json)
  end

  describe '#call' do
    context 'with skills and valid generation' do
      let!(:vacancy_skill1) { create(:vacancy_skill, vacancy: vacancy, skill_id: 's1', skill_label: 'Ruby', expected_level: 3) }
      let!(:vacancy_skill2) { create(:vacancy_skill, vacancy: vacancy, skill_id: 's2', skill_label: 'Rails', expected_level: 4) }
      let!(:vacancy_skill3) { create(:vacancy_skill, vacancy: vacancy, skill_id: 's3', skill_label: 'React', expected_level: 3) }
      let!(:vacancy_skill4) { create(:vacancy_skill, vacancy: vacancy, skill_id: 's4', skill_label: 'AWS', expected_level: 2) }

      let!(:portfolio_skill1) { create(:portfolio_skill, portfolio: portfolio, skill_id: 's1', skill_label: 'Ruby', ai_level: 3) } # Match
      let!(:portfolio_skill2) { create(:portfolio_skill, portfolio: portfolio, skill_id: 's2', skill_label: 'Rails', ai_level: 2) } # Gap
      let!(:portfolio_skill3) { create(:portfolio_skill, portfolio: portfolio, skill_id: 's3', skill_label: 'React', ai_level: 4) } # Exceed
      # s4 is missing -> Not Assessed

      it 'creates or updates a FitGapReport' do
        expect { engine.call }.to change(FitGapReport, :count).by(1)
        
        report = FitGapReport.last
        expect(report.portfolio).to eq(portfolio)
        expect(report.vacancy).to eq(vacancy)
        expect(report.culture_narrative).to eq('Excellent culture fit.')
        expect(report.overall_narrative).to eq('Highly recommended for hire.')
        expect(report.skill_comparisons.size).to eq(4)
      end

      it 'correctly evaluates skill matches, gaps, exceeds, and not assessed' do
        report = engine.call
        comparisons = report.skill_comparisons
        
        ruby_comp = comparisons.find { |c| c['skill_label'] == 'Ruby' }
        expect(ruby_comp['result']).to eq('match')
        expect(ruby_comp['delta']).to eq(0)

        rails_comp = comparisons.find { |c| c['skill_label'] == 'Rails' }
        expect(rails_comp['result']).to eq('gap')
        expect(rails_comp['delta']).to eq(-2)

        react_comp = comparisons.find { |c| c['skill_label'] == 'React' }
        expect(react_comp['result']).to eq('exceed')
        expect(react_comp['delta']).to eq(1)

        aws_comp = comparisons.find { |c| c['skill_label'] == 'AWS' }
        expect(aws_comp['result']).to eq('not_assessed')
        expect(aws_comp['delta']).to be_nil
      end

      context 'with assessor overrides' do
        let!(:override) { create(:assessor_override, portfolio_skill: portfolio_skill2, ai_level: 2, override_level: 5, overridden_by: 'Admin') }

        it 'uses effective level from overrides' do
          report = engine.call
          rails_comp = report.skill_comparisons.find { |c| c['skill_label'] == 'Rails' }
          
          # AI level was 2, expected 4, but override is 5 -> Exceed (+1)
          expect(rails_comp['candidate_level']).to eq(5)
          expect(rails_comp['result']).to eq('exceed')
          expect(rails_comp['delta']).to eq(1)
        end
      end
    end

    context 'when API raises an error' do
      before do
        allow(gemini_client).to receive(:generate_content).and_raise(StandardError, 'API Timeout')
      end

      it 'rescues the error and generates a fallback narrative' do
        create(:vacancy_skill, vacancy: vacancy, skill_id: 's1', skill_label: 'Ruby', expected_level: 3)
        create(:portfolio_skill, portfolio: portfolio, skill_id: 's1', skill_label: 'Ruby', ai_level: 3)

        report = engine.call
        expect(report.culture_narrative).to be_nil
        expect(report.overall_narrative).to include('Candidate shows 1 skill matches')
      end
    end


  end
end
