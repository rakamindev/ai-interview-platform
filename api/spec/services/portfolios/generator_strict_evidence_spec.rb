# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Portfolios::Generator Strict Evidence Schema', type: :service do
  let!(:org) { Organization.create!(id: 290, scheme: 'test-org', name: 'Test Org', identifier: 'test-org', host: 'localhost') }
  let!(:assessment) { Assessment.unscoped.create!(tenant_id: org.id, name: 'Evidence Assessment', created_by: 1, time_limit_min: 30) }
  let!(:skill_config) do
    assessment.assessment_skills.create!(
      skill_id: 'SK-ENG-001',
      skill_label: 'Frontend Development',
      display_order: 1,
      l1_anchor: 'L1', l2_anchor: 'L2', l3_anchor: 'L3', l4_anchor: 'L4', l5_anchor: 'L5'
    )
  end

  let!(:session) { Session.unscoped.create!(tenant_id: org.id, assessment_id: assessment.id, candidate_id: 890, status: 'ended') }
  let!(:portfolio) { session.create_portfolio!(candidate_id: session.candidate_id, generation_status: 'pending') }
  let(:mock_gemini_client) { instance_double(Gemini::HttpClient) }

  def payload_with_evidence(evidence_value)
    {
      'configured_skills' => [
        {
          'skill_id' => 'SK-ENG-001',
          'skill_label' => 'Frontend Development',
          'level' => 3,
          'confidence' => 'high',
          'evidence' => evidence_value,
          'competency_summary' => 'Solid skills.'
        }
      ],
      'discovered_skills' => []
    }
  end

  it 'rejects evidence when it is a plain string instead of an array' do
    allow(mock_gemini_client).to receive(:generate_content).and_return(payload_with_evidence('Just a string quote'))
    generator = Portfolios::Generator.new(session: session, gemini_client: mock_gemini_client)
    expect { generator.call }.to raise_error(Portfolios::Generator::ValidationError, /evidence must be an array of strings/)
  end

  it 'rejects evidence when array contains integers, booleans, or objects' do
    invalid_items = [
      [123],
      [true],
      [false],
      [{ 'quote' => 'hello' }],
      ['Valid quote', 456]
    ]

    invalid_items.each do |invalid_evidence|
      allow(mock_gemini_client).to receive(:generate_content).and_return(payload_with_evidence(invalid_evidence))
      generator = Portfolios::Generator.new(session: session, gemini_client: mock_gemini_client)
      expect { generator.call }.to raise_error(Portfolios::Generator::ValidationError, /evidence must be an array of strings/)
    end
  end

  it 'rejects evidence containing empty or whitespace-only strings' do
    blank_evidence_cases = [
      [''],
      ['   '],
      ['valid quote', ''],
      ['valid quote', '   ']
    ]

    blank_evidence_cases.each do |blank_case|
      allow(mock_gemini_client).to receive(:generate_content).and_return(payload_with_evidence(blank_case))
      generator = Portfolios::Generator.new(session: session, gemini_client: mock_gemini_client)
      expect { generator.call }.to raise_error(Portfolios::Generator::ValidationError, /evidence quotes cannot be empty or blank/)
    end
  end

  it 'accepts valid empty evidence array and valid string array with stripped content' do
    allow(mock_gemini_client).to receive(:generate_content).and_return(payload_with_evidence(['  Candidate wrote clean TypeScript.  ']))
    generator = Portfolios::Generator.new(session: session, gemini_client: mock_gemini_client)
    expect { generator.call }.not_to raise_error

    expect(portfolio.reload.portfolio_skills.first.evidence).to eq(['Candidate wrote clean TypeScript.'])
  end

  it 'accepts valid empty evidence array' do
    allow(mock_gemini_client).to receive(:generate_content).and_return(payload_with_evidence([]))
    generator = Portfolios::Generator.new(session: session, gemini_client: mock_gemini_client)
    expect { generator.call }.not_to raise_error

    expect(portfolio.reload.portfolio_skills.first.evidence).to eq([])
  end
end
