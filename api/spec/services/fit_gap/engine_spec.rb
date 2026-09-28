require 'rails_helper'

RSpec.describe FitGap::Engine do
  let(:portfolio) { double('Portfolio', id: 1, session: double('Session', assessment: double('Assessment'))) }
  let(:vacancy) { double('Vacancy', id: 1, role_title: 'Developer', culture_dimensions: '', competency_expectations: '') }
  let(:gemini_client) { double('Gemini::HttpClient') }
  
  let(:engine) { described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: gemini_client) }

  before do
    allow(gemini_client).to receive(:generate_content).and_return({
      'culture_narrative' => 'Culture narrative',
      'overall_narrative' => 'Overall narrative'
    }.to_json)
    
    # Mocking ActiveRecord find_or_initialize_by
    report_mock = double('FitGapReport', id: 1)
    allow(report_mock).to receive(:update!)
    allow(FitGapReport).to receive(:find_or_initialize_by).and_return(report_mock)
  end

  describe '#build_skill_comparisons' do
    context 'when skills are assessed normally' do
      let(:vacancy_skill) { double('VacancySkill', skill_id: 101, expected_level: 3) }
      let(:portfolio_skill) do
        double('PortfolioSkill',
          id: 201,
          skill_id: 101,
          skill_label: 'Ruby',
          ai_level: 2,
          ai_confidence: 'high',
          assessor_override: nil
        )
      end

      before do
        allow(vacancy).to receive(:vacancy_skills).and_return([vacancy_skill])
        allow(vacancy_skill).to receive(:skill_label).and_return('Ruby')
        
        # Portfolio setup
        skills_relation = [portfolio_skill]
        allow(skills_relation).to receive(:includes).with(:assessor_override).and_return(skills_relation)
        allow(portfolio).to receive(:portfolio_skills).and_return(skills_relation)
      end

      it 'returns required_level instead of expected_level (Bug #1 Fix)' do
        comparisons = engine.send(:build_skill_comparisons)
        ruby_comp = comparisons.first
        
        expect(ruby_comp.keys).to include(:required_level)
        expect(ruby_comp.keys).not_to include(:expected_level)
        expect(ruby_comp[:required_level]).to eq(3)
        expect(ruby_comp[:delta]).to eq(-1)
        expect(ruby_comp[:result]).to eq('gap')
        expect(ruby_comp[:is_override]).to be(false)
      end
    end

    context 'when skill has assessor override (Bug #1 Fix)' do
      let(:vacancy_skill) { double('VacancySkill', skill_id: 101, expected_level: 3) }
      let(:override) { double('AssessorOverride', override_level: 4, present?: true) }
      let(:portfolio_skill) do
        double('PortfolioSkill',
          id: 201,
          skill_id: 101,
          skill_label: 'Ruby',
          ai_level: 2,
          ai_confidence: 'high',
          assessor_override: override
        )
      end

      before do
        allow(vacancy).to receive(:vacancy_skills).and_return([vacancy_skill])
        allow(vacancy_skill).to receive(:skill_label).and_return('Ruby')
        
        skills_relation = [portfolio_skill]
        allow(skills_relation).to receive(:includes).with(:assessor_override).and_return(skills_relation)
        allow(portfolio).to receive(:portfolio_skills).and_return(skills_relation)
      end

      it 'returns is_override as true and uses override_level' do
        comparisons = engine.send(:build_skill_comparisons)
        ruby_comp = comparisons.first
        
        expect(ruby_comp[:is_override]).to be(true)
        # 4 (override) - 3 (expected) = 1 (exceed)
        expect(ruby_comp[:delta]).to eq(1)
        expect(ruby_comp[:result]).to eq('exceed')
      end
    end

    context 'when vacancy skill is missing expected_level (Bug #2 Fix)' do
      let(:vacancy_skill) { double('VacancySkill', skill_id: 102, expected_level: nil) }
      let(:portfolio_skill) do
        double('PortfolioSkill',
          id: 202,
          skill_id: 102,
          skill_label: 'Go',
          ai_level: 3,
          ai_confidence: 'medium',
          assessor_override: nil
        )
      end

      before do
        allow(vacancy).to receive(:vacancy_skills).and_return([vacancy_skill])
        allow(vacancy_skill).to receive(:skill_label).and_return('Go')
        
        skills_relation = [portfolio_skill]
        allow(skills_relation).to receive(:includes).with(:assessor_override).and_return(skills_relation)
        allow(portfolio).to receive(:portfolio_skills).and_return(skills_relation)
      end

      it 'does not crash and sets delta to nil, result to not_assessed' do
        expect {
          comparisons = engine.send(:build_skill_comparisons)
          go_comp = comparisons.first
          
          expect(go_comp[:required_level]).to be_nil
          expect(go_comp[:delta]).to be_nil
          expect(go_comp[:result]).to eq('not_assessed')
        }.not_to raise_error
      end
    end
  end
end
