# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGap::Engine, type: :service do
  let(:org) do
    Organization.find_or_create_by!(scheme: 'test-corp') do |o|
      o.name = 'Test Corp'
      o.identifier = 'test-corp'
      o.host = 'localhost'
    end
  end

  let(:assessment) do
    Assessment.create!(
      tenant_id: org.id,
      created_by: 1,
      name: 'Fullstack Assessment',
      time_limit_min: 30
    )
  end

  let(:session) do
    Session.create!(
      assessment: assessment,
      tenant_id: org.id,
      candidate_name: 'Budi Santoso',
      status: 'ended'
    )
  end

  let(:portfolio) do
    session.create_portfolio!(
      candidate_id: 1,
      generation_status: 'complete'
    )
  end

  let(:vacancy) do
    Vacancy.create!(
      role_title: 'Senior Frontend Engineer',
      tenant_id: org.id,
      created_by: 1,
      culture_dimensions: 'Collaborative, high ownership',
      competency_expectations: 'Strong React and architecture'
    )
  end

  before do
    # Add vacancy skills
    vacancy.vacancy_skills.create!(
      skill_id: 'SK-ENG-001',
      skill_label: 'React / Frontend Development Core',
      expected_level: 3
    )

    vacancy.vacancy_skills.create!(
      skill_id: 'SK-ENG-002',
      skill_label: 'Node.js / Backend Development',
      expected_level: 4
    )

    # Add portfolio skill with AI level 2
    @react_skill = portfolio.portfolio_skills.create!(
      skill_id: 'SK-ENG-001',
      skill_label: 'React / Frontend Development Core',
      is_discovered: false,
      ai_level: 2,
      ai_confidence: 'high',
      evidence: ['Implemented custom hooks with memoization.'],
      competency_summary: 'Demonstrated solid understanding of React internals.'
    )
  end

  describe '#call' do
    it 'produces comparisons with both expected_level and required_level and flags overrides' do
      # Add assessor override: upgrade from L2 to L4
      AssessorOverride.create!(
        portfolio_skill_id: @react_skill.id,
        ai_level: 2,
        override_level: 4,
        assessor_notes: 'Candidate showed architect-level insight in code discussion.',
        overridden_by: 1
      )

      # Stub Gemini client for narrative generation
      fake_gemini = instance_double(Gemini::HttpClient)
      allow(fake_gemini).to receive(:generate_content).and_return({
        culture: 'Strong culture fit with team autonomy.',
        overall: 'Recommended for hiring based on senior frontend strength.'
      })

      engine = described_class.new(
        portfolio: portfolio,
        vacancy: vacancy,
        gemini_client: fake_gemini
      )

      report = engine.call
      expect(report).to be_persisted

      comparisons = report.skill_comparisons
      react_comp = comparisons.find { |c| c['skill_id'] == 'SK-ENG-001' }
      node_comp = comparisons.find { |c| c['skill_id'] == 'SK-ENG-002' }

      expect(react_comp).to be_present
      expect(react_comp['required_level']).to eq(3)
      expect(react_comp['expected_level']).to eq(3)
      expect(react_comp['candidate_level']).to eq(4) # Effective overridden level
      expect(react_comp['is_override']).to be true
      expect(react_comp['result']).to eq('exceed')

      expect(node_comp).to be_present
      expect(node_comp['result']).to eq('not_assessed')
      expect(node_comp['candidate_level']).to be_nil
    end
  end
end
