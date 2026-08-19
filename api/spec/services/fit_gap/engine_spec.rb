# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGap::Engine do
  let(:org) { Organization.find_by(scheme: 'test-corp') || Organization.create!(name: 'Test Corp', scheme: 'test-corp', identifier: 'test-corp', host: 'localhost') }
  let(:assessment) do
    Assessment.create!(
      tenant_id: org.id,
      created_by: 1,
      name: 'Full Stack Engineer',
      time_limit_min: 45
    )
  end
  let(:session) { Session.create!(tenant_id: org.id, assessment: assessment) }
  let(:portfolio) { Portfolio.create!(session: session, generation_status: 'complete') }

  let(:vacancy) do
    v = Vacancy.create!(
      tenant_id: org.id,
      created_by: 1,
      role_title: 'Senior Engineer',
      culture_dimensions: 'Async and ownership',
      competency_expectations: 'Strong communicator'
    )
    v.vacancy_skills.create!(skill_id: 'SK-ENG-001', skill_label: 'React', expected_level: 3)
    v.vacancy_skills.create!(skill_id: 'SK-ENG-002', skill_label: 'Node.js', expected_level: 4)
    v.vacancy_skills.create!(skill_id: 'SK-SOFT-001', skill_label: 'Communication', expected_level: 3)
    v
  end

  let(:mock_gemini) do
    instance_double(Gemini::HttpClient, generate_content: {
      'culture_narrative' => 'Strong ownership mindset.',
      'overall_narrative' => 'Good candidate for the senior role.'
    })
  end

  before do
    skill1 = portfolio.portfolio_skills.create!(
      skill_id: 'SK-ENG-001',
      skill_label: 'React',
      ai_level: 4,
      ai_confidence: 'high',
      evidence: ['Quote about hooks'],
      competency_summary: 'Proficient in modern React'
    )

    skill2 = portfolio.portfolio_skills.create!(
      skill_id: 'SK-ENG-002',
      skill_label: 'Node.js',
      ai_level: 2,
      ai_confidence: 'medium',
      evidence: ['Quote about Express'],
      competency_summary: 'Basic Node.js CRUD'
    )

    # Assessor overrides skill2 from L2 to L3
    AssessorOverride.create!(
      portfolio_skill: skill2,
      ai_level: 2,
      override_level: 3,
      assessor_notes: 'Demonstrated solid architecture understanding in turn 14',
      overridden_by: 1
    )
  end

  it 'generates a fit/gap report with exact expected_level, deltas, and override flags' do
    engine = described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: mock_gemini)
    report = engine.call

    expect(report).to be_persisted
    expect(report.culture_narrative).to eq('Strong ownership mindset.')

    comparisons = report.skill_comparisons

    react_comp = comparisons.find { |c| c['skill_label'] == 'React' }
    expect(react_comp['expected_level']).to eq(3)
    expect(react_comp['candidate_level']).to eq(4)
    expect(react_comp['delta']).to eq(1)
    expect(react_comp['result']).to eq('exceed')
    expect(react_comp['is_override']).to be false

    node_comp = comparisons.find { |c| c['skill_label'] == 'Node.js' }
    expect(node_comp['expected_level']).to eq(4)
    expect(node_comp['candidate_level']).to eq(3) # Effective level after override
    expect(node_comp['delta']).to eq(-1)
    expect(node_comp['result']).to eq('gap')
    expect(node_comp['is_override']).to be true

    comm_comp = comparisons.find { |c| c['skill_label'] == 'Communication' }
    expect(comm_comp['expected_level']).to eq(3)
    expect(comm_comp['candidate_level']).to be_nil
    expect(comm_comp['result']).to eq('not_assessed')
  end
end
