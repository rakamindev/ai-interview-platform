# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGap::Engine do
  let(:assessment) do
    Assessment.create!(name: 'Backend Dev', time_limit_min: 30, tenant_id: Current.tenant_id, created_by: 1)
  end

  let(:session) do
    Session.create!(assessment: assessment, candidate_name: 'Toji', tenant_id: Current.tenant_id, status: 'ended')
  end

  let(:portfolio) do
    Portfolio.create!(session: session, generation_status: 'complete')
  end

  let(:vacancy) do
    Vacancy.create!(
      role_title: 'Senior Backend Engineer',
      tenant_id: Current.tenant_id,
      created_by: 1,
      vacancy_skills_attributes: [
        { skill_label: 'Database Design & SQL', expected_level: 5 },
        { skill_label: 'Node.js / Backend Development', expected_level: 3 }
      ]
    )
  end

  let!(:db_skill) do
    portfolio.portfolio_skills.create!(
      skill_label: 'Database Design & SQL',
      ai_level: 2,
      ai_confidence: 'medium',
      competency_summary: 'Basic SQL operations'
    )
  end

  let!(:node_skill) do
    portfolio.portfolio_skills.create!(
      skill_label: 'Node.js / Backend Development',
      ai_level: 3,
      ai_confidence: 'high',
      competency_summary: 'Solid backend capabilities'
    )
  end

  let(:mock_gemini) do
    double('GeminiClient', generate_content: {
      'culture_narrative' => 'Strong culture alignment.',
      'overall_narrative' => 'Good candidate.'
    })
  end

  describe '#call' do
    it 'computes expected_level and identifies gap vs match correctly' do
      engine = described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: mock_gemini)
      report = engine.call

      comparisons = report.skill_comparisons
      db_comp = comparisons.find { |c| c['skill_label'] == 'Database Design & SQL' }
      node_comp = comparisons.find { |c| c['skill_label'] == 'Node.js / Backend Development' }

      expect(db_comp['expected_level']).to eq(5)
      expect(db_comp['candidate_level']).to eq(2)
      expect(db_comp['result']).to eq('gap')
      expect(db_comp['delta']).to eq(-3)
      expect(db_comp['is_override']).to be false

      expect(node_comp['expected_level']).to eq(3)
      expect(node_comp['candidate_level']).to eq(3)
      expect(node_comp['result']).to eq('match')
      expect(node_comp['delta']).to eq(0)
    end

    it 'correctly marks is_override when an assessor override is present' do
      # Assessor overrides DB skill from L2 to L4
      AssessorOverride.create!(
        portfolio_skill: db_skill,
        ai_level: 2,
        override_level: 4,
        assessor_notes: 'Demonstrated deeper knowledge during live interview',
        overridden_by: 1
      )

      engine = described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: mock_gemini)
      report = engine.call

      db_comp = report.skill_comparisons.find { |c| c['skill_label'] == 'Database Design & SQL' }
      expect(db_comp['candidate_level']).to eq(4)
      expect(db_comp['expected_level']).to eq(5)
      expect(db_comp['delta']).to eq(-1)
      expect(db_comp['is_override']).to be true
    end
  end
end
