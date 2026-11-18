# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGap::Engine do
  let(:org) { Organization.find_or_create_by!(id: 1, name: 'Test Corp', scheme: 'test-corp', identifier: 'test-corp', host: 'localhost') }
  let(:assessment) do
    Current.organization = org
    Current.tenant_id = org.id
    Assessment.create!(name: 'Fullstack Engineer', time_limit_min: 45, created_by: 1)
  end
  let(:session_record) do
    Current.organization = org
    Current.tenant_id = org.id
    Session.create!(assessment: assessment, tenant_id: org.id)
  end
  let(:portfolio) { Portfolio.create!(session: session_record, generation_status: 'complete') }
  let(:vacancy) do
    Current.organization = org
    Current.tenant_id = org.id
    v = Vacancy.create!(role_title: 'Fullstack Engineer', created_by: 1)
    v.vacancy_skills.create!(skill_label: 'React', expected_level: 3)
    v.vacancy_skills.create!(skill_label: 'Node.js', expected_level: 3)
    v.vacancy_skills.create!(skill_label: 'System Design', expected_level: 4)
    v.vacancy_skills.create!(skill_label: 'Docker', expected_level: 2)
    v
  end

  let(:mock_gemini) do
    double('GeminiClient', generate_content: {
      'culture_narrative' => 'Strong culture match.',
      'overall_narrative' => 'Recommended for next round.'
    })
  end

  before do
    Current.organization = org
    Current.tenant_id = org.id

    # 1. Assessed match: React L3
    portfolio.portfolio_skills.create!(
      skill_label: 'React',
      is_assessed: true,
      ai_level: 3,
      ai_confidence: 'high',
      competency_summary: 'Solid React'
    )

    # 2. Assessed with Human Override: Node.js AI L2 -> Override L4 (exceed)
    node_skill = portfolio.portfolio_skills.create!(
      skill_label: 'Node.js',
      is_assessed: true,
      ai_level: 2,
      ai_confidence: 'medium',
      competency_summary: 'Backend skills'
    )
    node_skill.create_assessor_override!(
      ai_level: 2,
      override_level: 4,
      assessor_notes: 'Demonstrated extensive Node experience in deep dive',
      overridden_by: 1
    )

    # 3. Unassessed skill: System Design
    portfolio.portfolio_skills.create!(
      skill_label: 'System Design',
      is_assessed: false,
      ai_level: nil,
      ai_confidence: 'low',
      competency_summary: 'Not assessed'
    )

    # 4. Docker is not in portfolio at all
  end

  it 'generates comparison conforming to the frontend contract seam' do
    engine = described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: mock_gemini)
    report = engine.call

    comparisons = report.skill_comparisons
    expect(comparisons.size).to eq(4)

    react = comparisons.find { |c| c['skill_label'] == 'React' }
    expect(react['result']).to eq('match')
    expect(react['expected_level']).to eq(3)
    expect(react['required_level']).to eq(3)
    expect(react['candidate_level']).to eq(3)
    expect(react['delta']).to eq(0)
    expect(react['is_override']).to be(false)

    nodejs = comparisons.find { |c| c['skill_label'] == 'Node.js' }
    expect(nodejs['result']).to eq('exceed')
    expect(nodejs['expected_level']).to eq(3)
    expect(nodejs['required_level']).to eq(3)
    expect(nodejs['candidate_level']).to eq(4)
    expect(nodejs['delta']).to eq(1)
    expect(nodejs['is_override']).to be(true)
    expect(nodejs['assessor_notes']).to include('extensive Node experience')

    sys_design = comparisons.find { |c| c['skill_label'] == 'System Design' }
    expect(sys_design['result']).to eq('not_assessed')
    expect(sys_design['candidate_level']).to be_nil
    expect(sys_design['expected_level']).to eq(4)
    expect(sys_design['required_level']).to eq(4)

    docker = comparisons.find { |c| c['skill_label'] == 'Docker' }
    expect(docker['result']).to eq('not_assessed')
    expect(docker['candidate_level']).to be_nil
  end
end
