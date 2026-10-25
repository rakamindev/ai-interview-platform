# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGap::Engine do
  let(:vacancy_skill1) do
    double('VacancySkill', skill_id: 1, skill_label: 'Ruby on Rails Architecture', expected_level: 4)
  end
  let(:vacancy_skill2) do
    double('VacancySkill', skill_id: 2, skill_label: 'PostgreSQL Database Performance', expected_level: 3)
  end
  let(:vacancy_skill3) do
    double('VacancySkill', skill_id: 3, skill_label: 'Kubernetes Container Orchestration', expected_level: 4)
  end

  let(:vacancy) do
    double('Vacancy', id: 10, vacancy_skills: [vacancy_skill1, vacancy_skill2, vacancy_skill3])
  end

  let(:override) { double('AssessorOverride', override_level: 5) }
  let(:portfolio_skill1) do
    double(
      'PortfolioSkill',
      id: 101,
      skill_id: 1,
      skill_label: 'Ruby on Rails Architecture',
      ai_level: 4,
      ai_confidence: 'high',
      assessor_override: nil
    )
  end
  let(:portfolio_skill2) do
    double(
      'PortfolioSkill',
      id: 102,
      skill_id: 2,
      skill_label: 'PostgreSQL Database Performance',
      ai_level: 2,
      ai_confidence: 'medium',
      assessor_override: override
    )
  end

  let(:portfolio_skills_relation) { [portfolio_skill1, portfolio_skill2] }
  let(:portfolio) do
    double('Portfolio', id: 20, portfolio_skills: portfolio_skills_relation)
  end

  let(:mock_gemini_client) { instance_double(Gemini::HttpClient) }

  subject(:engine) { described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: mock_gemini_client) }

  before do
    allow(portfolio_skills_relation).to receive(:includes).with(:assessor_override).and_return(portfolio_skills_relation)
  end

  describe '#build_skill_comparisons (DEF-P1-01 & DEF-P1-02)' do
    it 'harmonizes required_level and flags human overrides accurately' do
      comparisons = engine.send(:build_skill_comparisons)

      # 1. Match item: Rails Architecture
      rails_comp = comparisons.find { |c| c[:skill_label] == 'Ruby on Rails Architecture' }
      expect(rails_comp).not_to be_nil
      expect(rails_comp[:required_level]).to eq(4)
      expect(rails_comp[:candidate_level]).to eq(4)
      expect(rails_comp[:delta]).to eq(0)
      expect(rails_comp[:result]).to eq('match')
      expect(rails_comp[:is_override]).to be false

      # 2. Overridden item: PostgreSQL Database Performance (AI: 2, Override: 5, Expected: 3 => Exceed)
      pg_comp = comparisons.find { |c| c[:skill_label] == 'PostgreSQL Database Performance' }
      expect(pg_comp).not_to be_nil
      expect(pg_comp[:required_level]).to eq(3)
      expect(pg_comp[:candidate_level]).to eq(5) # uses override level
      expect(pg_comp[:delta]).to eq(2)
      expect(pg_comp[:result]).to eq('exceed')
      expect(pg_comp[:is_override]).to be true

      # 3. Not assessed item: Kubernetes
      k8s_comp = comparisons.find { |c| c[:skill_label] == 'Kubernetes Container Orchestration' }
      expect(k8s_comp).not_to be_nil
      expect(k8s_comp[:required_level]).to eq(4)
      expect(k8s_comp[:candidate_level]).to be_nil
      expect(k8s_comp[:delta]).to be_nil
      expect(k8s_comp[:result]).to eq('not_assessed')
      expect(k8s_comp[:is_override]).to be false
    end
  end
end
