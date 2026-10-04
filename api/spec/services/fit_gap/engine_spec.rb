# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGap::Engine do
  let(:vacancy_skill_match) do
    double('VacancySkill', skill_label: 'React', skill_id: 1, expected_level: 3)
  end
  
  let(:vacancy_skill_nil) do
    double('VacancySkill', skill_label: 'System Design', skill_id: 2, expected_level: 4)
  end
  
  let(:vacancy_skill_missing) do
    double('VacancySkill', skill_label: 'Go', skill_id: 99, expected_level: 3)
  end

  let(:vacancy) do
    v = double('Vacancy')
    allow(v).to receive(:vacancy_skills).and_return(
      double(index_by: {
        'React' => vacancy_skill_match,
        'System Design' => vacancy_skill_nil,
        'Go' => vacancy_skill_missing
      })
    )
    allow(v).to receive_messages(role_title: 'Engineer', culture_dimensions: nil, competency_expectations: nil, id: 1)
    v
  end

  let(:portfolio_skills) do
    [
      { id: 1, skill_id: 1, skill_label: 'React', ai_level: 3, effective_level: 3, confidence: 'high', overridden: false },
      { id: 2, skill_id: 2, skill_label: 'System Design', ai_level: nil, effective_level: nil, confidence: 'low', overridden: false }
    ]
  end

  let(:portfolio) do
    p = double('Portfolio')
    allow(p).to receive(:id).and_return(1)
    allow(p).to receive(:session).and_return(double(assessment: double))
    
    skill_objects = portfolio_skills.map do |ps|
      double('PortfolioSkill', 
             id: ps[:id], 
             skill_id: ps[:skill_id], 
             skill_label: ps[:skill_label], 
             ai_level: ps[:ai_level], 
             ai_confidence: ps[:confidence],
             assessor_override: ps[:overridden] ? double(override_level: ps[:effective_level]) : nil)
    end
    
    skills_relation = double('PortfolioSkillsRelation')
    allow(skills_relation).to receive(:includes).with(:assessor_override).and_return(skill_objects)
    allow(p).to receive(:portfolio_skills).and_return(skills_relation)
    
    p
  end
  
  let(:gemini_client) do
    client = double('GeminiClient')
    allow(client).to receive(:generate_content).and_return({
      'culture_narrative' => 'Culture narrative stub',
      'overall_narrative' => 'Overall narrative stub'
    })
    client
  end

  subject(:engine) { described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: gemini_client) }

  describe '#build_skill_comparisons' do
    let(:comparisons) { engine.send(:build_skill_comparisons) }

    it 'returns "match" when candidate_level equals expected_level' do
      react_comp = comparisons.find { |c| c[:skill_label] == 'React' }
      expect(react_comp[:result]).to eq('match')
      expect(react_comp[:delta]).to eq(0)
    end

    it 'returns "not_assessed" and does not crash when candidate_level is nil (SEEDED FAULT FIX)' do
      sys_design_comp = comparisons.find { |c| c[:skill_label] == 'System Design' }
      expect(sys_design_comp[:result]).to eq('not_assessed')
      expect(sys_design_comp[:delta]).to be_nil
    end

    it 'returns "not_assessed" when skill is completely missing from portfolio' do
      go_comp = comparisons.find { |c| c[:skill_label] == 'Go' }
      expect(go_comp[:result]).to eq('not_assessed')
      expect(go_comp[:delta]).to be_nil
    end
  end
end
