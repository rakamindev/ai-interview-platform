# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Portfolios::Generator Custom Skills Handling', type: :service do
  let!(:org) { Organization.create!(id: 270, scheme: 'test-org', name: 'Test Org', identifier: 'test-org', host: 'localhost') }
  let!(:assessment) { Assessment.unscoped.create!(tenant_id: org.id, name: 'Custom Skills Assessment', created_by: 1, time_limit_min: 30) }

  let!(:taxonomy_skill) do
    assessment.assessment_skills.create!(
      skill_id: 'SK-ENG-001',
      skill_label: 'React / Frontend Development',
      display_order: 1,
      l1_anchor: 'L1', l2_anchor: 'L2', l3_anchor: 'L3', l4_anchor: 'L4', l5_anchor: 'L5'
    )
  end

  let!(:custom_skill_1) do
    assessment.assessment_skills.create!(
      skill_id: nil,
      skill_label: 'Custom Company Protocol A',
      display_order: 2,
      l1_anchor: 'L1', l2_anchor: 'L2', l3_anchor: 'L3', l4_anchor: 'L4', l5_anchor: 'L5'
    )
  end

  let!(:custom_skill_2) do
    assessment.assessment_skills.create!(
      skill_id: nil,
      skill_label: 'Custom Company Protocol B',
      display_order: 3,
      l1_anchor: 'L1', l2_anchor: 'L2', l3_anchor: 'L3', l4_anchor: 'L4', l5_anchor: 'L5'
    )
  end

  let!(:session) { Session.unscoped.create!(tenant_id: org.id, assessment_id: assessment.id, candidate_id: 870, status: 'ended') }
  let!(:portfolio) { session.create_portfolio!(candidate_id: session.candidate_id, generation_status: 'pending') }
  let(:mock_gemini_client) { instance_double(Gemini::HttpClient) }

  it '6. Uniquely identifies and persists taxonomy skill and multiple custom skills without errors' do
    payload = {
      'configured_skills' => [
        {
          'skill_id' => 'SK-ENG-001',
          'skill_label' => 'React / Frontend Development',
          'level' => 4,
          'confidence' => 'high',
          'evidence' => ['React quote'],
          'competency_summary' => 'Strong React skills.'
        },
        {
          'skill_id' => "custom-#{custom_skill_1.id}",
          'skill_label' => 'Untrusted Label from AI',
          'level' => 3,
          'confidence' => 'medium',
          'evidence' => ['Protocol A quote'],
          'competency_summary' => 'Understands protocol A.'
        },
        {
          'skill_id' => "custom-#{custom_skill_2.id}",
          'skill_label' => 'Another AI label',
          'level' => 5,
          'confidence' => 'high',
          'evidence' => ['Protocol B quote'],
          'competency_summary' => 'Expert in protocol B.'
        }
      ],
      'discovered_skills' => []
    }

    allow(mock_gemini_client).to receive(:generate_content).and_return(payload)

    generator = Portfolios::Generator.new(session: session, gemini_client: mock_gemini_client)
    generator.call

    portfolio.reload
    expect(portfolio.generation_status).to eq('complete')
    expect(portfolio.portfolio_skills.count).to eq(3)

    # Verify taxonomy skill
    tax_ps = portfolio.portfolio_skills.find_by(skill_id: 'SK-ENG-001')
    expect(tax_ps.skill_label).to eq('React / Frontend Development')
    expect(tax_ps.ai_level).to eq(4)

    # Verify custom skill 1 has canonical label and nil skill_id in database
    cs1_ps = portfolio.portfolio_skills.find_by(skill_label: 'Custom Company Protocol A')
    expect(cs1_ps).to be_present
    expect(cs1_ps.skill_id).to be_nil
    expect(cs1_ps.ai_level).to eq(3)

    # Verify custom skill 2 has canonical label and nil skill_id in database
    cs2_ps = portfolio.portfolio_skills.find_by(skill_label: 'Custom Company Protocol B')
    expect(cs2_ps).to be_present
    expect(cs2_ps.skill_id).to be_nil
    expect(cs2_ps.ai_level).to eq(5)
  end
end
