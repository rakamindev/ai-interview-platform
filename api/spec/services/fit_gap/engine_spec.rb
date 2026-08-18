# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGap::Engine do
  describe '#build_skill_comparisons' do
    let(:gemini) { instance_double(Gemini::HttpClient) }
    let(:vacancy_skill_react) do
      instance_double(
        'VacancySkill',
        skill_label: 'React',
        skill_id: 10,
        expected_level: 3
      )
    end
    let(:vacancy_skill_design) do
      instance_double(
        'VacancySkill',
        skill_label: 'System Design',
        skill_id: 20,
        expected_level: 2
      )
    end
    let(:vacancy) do
      instance_double(
        'Vacancy',
        vacancy_skills: [vacancy_skill_react, vacancy_skill_design]
      )
    end
    let(:portfolio_skill) do
      instance_double(
        'PortfolioSkill',
        id: 1,
        skill_id: 10,
        skill_label: 'React',
        ai_level: 2,
        ai_confidence: 'medium',
        assessor_override: override
      )
    end
    let(:override) { nil }
    let(:portfolio) do
      instance_double(
        'Portfolio',
        id: 99,
        portfolio_skills: [portfolio_skill]
      )
    end
    let(:engine) { described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: gemini) }

    before do
      allow(portfolio_skill).to receive(:assessor_override).and_return(override)
      relation = double('PortfolioSkillsRelation')
      allow(portfolio).to receive(:portfolio_skills).and_return(relation)
      allow(relation).to receive(:includes).with(:assessor_override).and_return([portfolio_skill])
    end

    subject(:comparisons) { engine.send(:build_skill_comparisons) }

    it 'marks missing vacancy skills as not_assessed' do
      design = comparisons.find { |c| c[:skill_label] == 'System Design' }
      expect(design[:result]).to eq('not_assessed')
      expect(design[:candidate_level]).to be_nil
      expect(design[:required_level]).to eq(2)
      expect(design[:expected_level]).to eq(2)
    end

    it 'exposes required_level alias for the frontend contract' do
      react = comparisons.find { |c| c[:skill_label] == 'React' }
      expect(react[:expected_level]).to eq(3)
      expect(react[:required_level]).to eq(react[:expected_level])
      expect(react[:result]).to eq('gap')
      expect(react[:delta]).to eq(-1)
    end

    context 'when candidate exceeds expected level' do
      let(:portfolio_skill) do
        instance_double(
          'PortfolioSkill',
          id: 1,
          skill_id: 10,
          skill_label: 'React',
          ai_level: 5,
          ai_confidence: 'high',
          assessor_override: nil
        )
      end

      it 'marks the skill as exceed with a positive delta' do
        react = comparisons.find { |c| c[:skill_label] == 'React' }
        expect(react[:result]).to eq('exceed')
        expect(react[:delta]).to eq(2)
        expect(react[:overridden]).to eq(false)
      end
    end

    context 'with assessor override' do
      let(:override) do
        instance_double('AssessorOverride', override_level: 3, present?: true)
      end

      it 'applies override level and sets is_override' do
        react = comparisons.find { |c| c[:skill_label] == 'React' }
        expect(react[:candidate_level]).to eq(3)
        expect(react[:result]).to eq('match')
        expect(react[:overridden]).to eq(true)
        expect(react[:is_override]).to eq(true)
      end
    end
  end
end
