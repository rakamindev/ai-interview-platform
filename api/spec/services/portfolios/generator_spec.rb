# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Portfolios::Generator do
  let(:org) { Organization.find_by(scheme: 'test-corp') || Organization.create!(name: 'Test Corp', scheme: 'test-corp', identifier: 'test-corp', host: 'localhost') }
  let(:assessment) do
    a = Assessment.create!(
      tenant_id: org.id,
      created_by: 1,
      name: 'Backend Engineer',
      time_limit_min: 45
    )
    a.assessment_skills.create!(
      skill_id: 'SK-ENG-002',
      skill_label: 'Node.js',
      expected_level: 3,
      l1_anchor: 'L1', l2_anchor: 'L2', l3_anchor: 'L3', l4_anchor: 'L4', l5_anchor: 'L5'
    )
    a
  end
  let(:session) { Session.create!(tenant_id: org.id, assessment: assessment) }

  let(:mock_gemini) do
    instance_double(Gemini::HttpClient, generate_content: {
      'configured_skills' => [
        {
          'skill_id' => 'SK-ENG-002',
          'skill_label' => 'Node.js',
          'level' => 4,
          'confidence' => 'high',
          'evidence' => ['Handled 10k req/s using Redis streams'],
          'competency_summary' => 'Solid asynchronous architecture skills'
        }
      ],
      'discovered_skills' => [
        {
          'skill_label' => 'GraphQL',
          'level' => 3,
          'confidence' => 'low',
          'evidence' => ['Built Apollo federation gateways'],
          'competency_summary' => 'Hands-on experience with GraphQL schemas'
        }
      ]
    })
  end

  it 'populates portfolio skills and discovered skills with sanitized levels and evidence' do
    generator = described_class.new(session: session, gemini_client: mock_gemini)
    portfolio = generator.call

    expect(portfolio).to be_complete
    expect(portfolio.portfolio_skills.count).to eq(2)

    configured = portfolio.portfolio_skills.find_by(is_discovered: false)
    expect(configured.skill_label).to eq('Node.js')
    expect(configured.ai_level).to eq(4)
    expect(configured.ai_confidence).to eq('high')
    expect(configured.evidence_quotes).to include('Handled 10k req/s using Redis streams')

    discovered = portfolio.portfolio_skills.find_by(is_discovered: true)
    expect(discovered.skill_label).to eq('GraphQL')
    expect(discovered.ai_level).to eq(3)
    expect(discovered.ai_confidence).to eq('low')
  end
end
