# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Portfolios::Generator do
  let(:assessment) do
    a = Assessment.create!(tenant_id: 1, created_by: 1, name: 'Frontend Eng', time_limit_min: 45)
    a.assessment_skills.create!(
      skill_id: 'sk-1',
      skill_label: 'React',
      expected_level: 3,
      l1_anchor: 'Basic', l2_anchor: 'Intermediate', l3_anchor: 'Advanced', l4_anchor: 'Staff', l5_anchor: 'Principal'
    )
    a.assessment_skills.create!(
      skill_id: 'sk-2',
      skill_label: 'System Design',
      expected_level: 3,
      l1_anchor: 'Basic', l2_anchor: 'Intermediate', l3_anchor: 'Advanced', l4_anchor: 'Staff', l5_anchor: 'Principal'
    )
    a
  end

  let(:session) { Session.create!(tenant_id: 1, assessment: assessment, candidate_name: 'Ahmad') }
  let(:portfolio) { Portfolio.create!(session: session, candidate_id: 1, generation_status: 'generating') }

  describe '#save_skills' do
    it 'accurately categorizes probed skills as assessed and untouched skills as unassessed' do
      # React was probed during interview
      session.coverage_maps.create!(
        skill_id: 'sk-1',
        skill_label: 'React',
        state: 'covered',
        probe_count: 3,
        is_discovered: false
      )

      # System Design was never touched (interview ended early)
      session.coverage_maps.create!(
        skill_id: 'sk-2',
        skill_label: 'System Design',
        state: 'not_yet',
        probe_count: 0,
        is_discovered: false
      )

      gemini_mock_response = {
        'configured_skills' => [
          {
            'skill_id' => 'sk-1',
            'skill_label' => 'React',
            'level' => 3,
            'confidence' => 'high',
            'evidence' => ['Demonstrated deep hook architecture knowledge'],
            'competency_summary' => 'Reliable L3 React engineer'
          },
          {
            'skill_id' => 'sk-2',
            'skill_label' => 'System Design',
            'level' => 1, # AI might have hallucinated L1
            'confidence' => 'low',
            'evidence' => [],
            'competency_summary' => 'Weak knowledge'
          }
        ]
      }

      generator = described_class.new(session: session)
      generator.send(:save_skills, portfolio, gemini_mock_response)

      react_skill = portfolio.portfolio_skills.find_by(skill_label: 'React')
      expect(react_skill).to be_present
      expect(react_skill.status).to eq('assessed')
      expect(react_skill.ai_level).to eq(3)
      expect(react_skill.ai_confidence).to eq('high')
      expect(react_skill.evidence).to include('Demonstrated deep hook architecture knowledge')

      sys_skill = portfolio.portfolio_skills.find_by(skill_label: 'System Design')
      expect(sys_skill).to be_present
      expect(sys_skill.status).to eq('unassessed')
      expect(sys_skill.ai_level).to be_nil
      expect(sys_skill.evidence).to be_empty
      expect(sys_skill.competency_summary).to eq('Skill was not assessed during this interview session.')
    end
  end
end
