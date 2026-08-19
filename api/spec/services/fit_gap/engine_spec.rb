# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGap::Engine do
  describe '#build_skill_comparisons (via #call)' do
    let(:assessment) { double('Assessment') }
    let(:portfolio_session) { double('Session', assessment: assessment) }
    let(:portfolio) { double('Portfolio', id: 1, session: portfolio_session) }
    let(:vacancy) { double('Vacancy', id: 1, role_title: 'Senior Engineer') }
    let(:gemini_client) { instance_double('Gemini::HttpClient') }

    subject { described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: gemini_client) }

    before do
      allow(vacancy).to receive(:vacancy_skills).and_return(vacancy_skills_relation)
      allow(vacancy).to receive(:culture_dimensions).and_return(nil)
      allow(vacancy).to receive(:competency_expectations).and_return(nil)
    end

    context 'when portfolio has a skill with nil ai_level (unassessed)' do
      let(:portfolio_skill) do
        double('PortfolioSkill',
          id: 10,
          skill_id: 'SK-ENG-001',
          skill_label: 'React',
          ai_level: nil,
          ai_confidence: 'low',
          is_discovered: false
        )
      end

      let(:override_relation) { nil }

      let(:vacancy_skill) do
        double('VacancySkill',
          skill_id: 'SK-ENG-001',
          skill_label: 'React',
          expected_level: 3
        )
      end

      let(:vacancy_skills_relation) do
        double('vacancy_skills', index_by: { 'React' => vacancy_skill })
      end

      before do
        allow(portfolio_skill).to receive(:assessor_override).and_return(nil)

        portfolio_skills_with_includes = double('portfolio_skills_with_includes')
        allow(portfolio).to receive(:portfolio_skills).and_return(portfolio_skills_with_includes)
        allow(portfolio_skills_with_includes).to receive(:includes).with(:assessor_override).and_return([portfolio_skill])

        # Mock the narrative generation to return a simple hash
        allow(gemini_client).to receive(:generate_content).and_return({
          'culture_narrative' => 'Test narrative',
          'overall_narrative' => 'Test overall'
        })
      end

      it 'does not crash with NoMethodError on nil - integer' do
        report = instance_double('FitGapReport')
        allow(FitGapReport).to receive(:find_or_initialize_by).and_return(report)
        allow(report).to receive(:update!)

        expect { subject.call }.not_to raise_error
      end

      it 'classifies the unassessed skill as not_assessed with null delta' do
        report = instance_double('FitGapReport')
        allow(FitGapReport).to receive(:find_or_initialize_by).and_return(report)

        saved_comparisons = nil
        allow(report).to receive(:update!) do |attrs|
          saved_comparisons = attrs[:skill_comparisons]
        end

        subject.call

        react_comparison = saved_comparisons.find { |c| c[:skill_label] == 'React' }
        expect(react_comparison[:result]).to eq('not_assessed')
        expect(react_comparison[:candidate_level]).to be_nil
        expect(react_comparison[:delta]).to be_nil
      end
    end
  end
end
