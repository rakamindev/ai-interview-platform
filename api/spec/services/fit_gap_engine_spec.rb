# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGap::Engine do
  let(:assessment) { Assessment.create!(tenant_id: 1, created_by: 1, name: 'Frontend Eng', time_limit_min: 45) }
  let(:session)    { Session.create!(tenant_id: 1, assessment: assessment, candidate_name: 'Dewi') }
  let(:portfolio)  { Portfolio.create!(session: session, candidate_id: 1, generation_status: 'complete') }

  let(:vacancy) do
    v = Vacancy.create!(tenant_id: 1, created_by: 1, role_title: 'Senior Frontend Developer')
    v.vacancy_skills.create!(skill_label: 'React', expected_level: 3)
    v.vacancy_skills.create!(skill_label: 'TypeScript', expected_level: 4)
    v.vacancy_skills.create!(skill_label: 'System Design', expected_level: 3)
    v
  end

  describe '#build_skill_comparisons' do
    it 'accurately evaluates match, gap, and unassessed skills without crashing' do
      # React: assessed at level 3 (Match)
      portfolio.portfolio_skills.create!(
        skill_label:        'React',
        status:             'assessed',
        ai_level:           3,
        ai_confidence:      'high',
        evidence:           ['Solid hooks knowledge'],
        competency_summary: 'L3 React'
      )

      # TypeScript: assessed at level 2 (Gap: 2 - 4 = -2)
      portfolio.portfolio_skills.create!(
        skill_label:        'TypeScript',
        status:             'assessed',
        ai_level:           2,
        ai_confidence:      'medium',
        evidence:           ['Basic type usage'],
        competency_summary: 'L2 TS'
      )

      # System Design: UNASSESSED (probe_count was 0 during interview)
      portfolio.portfolio_skills.create!(
        skill_label:        'System Design',
        status:             'unassessed',
        ai_level:           nil,
        ai_confidence:      'low',
        evidence:           [],
        competency_summary: 'Skill was not assessed during this interview session.'
      )

      engine = described_class.new(portfolio: portfolio, vacancy: vacancy)
      comparisons = engine.send(:build_skill_comparisons)

      react_comp = comparisons.find { |c| c[:skill_label] == 'React' }
      expect(react_comp[:result]).to eq('match')
      expect(react_comp[:delta]).to eq(0)
      expect(react_comp[:candidate_level]).to eq(3)

      ts_comp = comparisons.find { |c| c[:skill_label] == 'TypeScript' }
      expect(ts_comp[:result]).to eq('gap')
      expect(ts_comp[:delta]).to eq(-2)
      expect(ts_comp[:candidate_level]).to eq(2)

      sys_comp = comparisons.find { |c| c[:skill_label] == 'System Design' }
      expect(sys_comp[:result]).to eq('not_assessed')
      expect(sys_comp[:delta]).to be_nil
      expect(sys_comp[:candidate_level]).to be_nil
    end
  end
end
