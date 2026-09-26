# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGap::Engine do
  let(:mock_gemini_client) { instance_double(Gemini::HttpClient) }
  let(:portfolio) { instance_double(Portfolio, id: 101) }
  let(:vacancy) { instance_double(Vacancy, id: 202, role_title: 'Fullstack Product Engineer') }

  let(:vacancy_skill_1) { instance_double(VacancySkill, skill_id: 'SK-01', skill_label: 'React Core', expected_level: 3) }
  let(:vacancy_skill_2) { instance_double(VacancySkill, skill_id: 'SK-02', skill_label: 'System Design', expected_level: 4) }
  let(:vacancy_skill_3) { instance_double(VacancySkill, skill_id: 'SK-03', skill_label: 'PostgreSQL', expected_level: 3) }

  before do
    allow(vacancy).to receive(:vacancy_skills).and_return([vacancy_skill_1, vacancy_skill_2, vacancy_skill_3])
    allow(vacancy).to receive(:culture_dimensions).and_return(nil)
    allow(vacancy).to receive(:competency_expectations).and_return(nil)
  end

  describe '#build_skill_comparisons' do
    it 'produces accurate comparisons with required_level alias and override flags' do
      engine = described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: mock_gemini_client)

      # Stub effective portfolio skills:
      # React Core: L3 (match)
      # System Design: L3 overridden to L5 (exceed, override=true)
      # PostgreSQL: unassessed (effective_level is nil)
      effective_skills = [
        {
          id: 1,
          skill_id: 'SK-01',
          skill_label: 'React Core',
          ai_level: 3,
          effective_level: 3,
          confidence: 'high',
          overridden: false
        },
        {
          id: 2,
          skill_id: 'SK-02',
          skill_label: 'System Design',
          ai_level: 3,
          effective_level: 5,
          confidence: 'medium',
          overridden: true
        },
        {
          id: 3,
          skill_id: 'SK-03',
          skill_label: 'PostgreSQL',
          ai_level: nil,
          effective_level: nil,
          confidence: nil,
          overridden: false
        }
      ]

      allow(engine).to receive(:effective_portfolio_skills).and_return(effective_skills)

      comparisons = engine.send(:build_skill_comparisons)
      by_label = comparisons.index_by { |c| c[:skill_label] }

      # 1. Match check
      react = by_label['React Core']
      expect(react[:result]).to eq('match')
      expect(react[:delta]).to eq(0)
      expect(react[:expected_level]).to eq(3)
      expect(react[:required_level]).to eq(3)
      expect(react[:is_override]).to be false

      # 2. Exceed check with override
      sys_design = by_label['System Design']
      expect(sys_design[:result]).to eq('exceed')
      expect(sys_design[:candidate_level]).to eq(5)
      expect(sys_design[:delta]).to eq(1) # 5 - 4
      expect(sys_design[:is_override]).to be true

      # 3. Unassessed skill check (Fairness / UU PDP)
      pg = by_label['PostgreSQL']
      expect(pg[:result]).to eq('not_assessed')
      expect(pg[:candidate_level]).to be_nil
      expect(pg[:delta]).to be_nil
    end
  end
end

