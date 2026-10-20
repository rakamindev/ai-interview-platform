# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Portfolios::Generator do
  let(:organization) { create(:organization) }
  let(:assessment) { create(:assessment, organization:) }
  let(:assessment_skill) do
    create(:assessment_skill, assessment:, skill_id: 'ruby', skill_label: 'Ruby')
  end
  let(:session) { create(:session, organization:, assessment:, status: 'ended') }
  let(:gemini_client) { instance_double(Gemini::HttpClient) }

  it 'preserves an assessor override when the AI portfolio is regenerated' do
    assessment_skill
    portfolio = create(:portfolio, organization:, session:, generation_status: 'failed')
    skill = create(:portfolio_skill, portfolio:, skill_id: 'ruby', skill_label: 'Ruby', ai_level: 3)
    override = create(:assessor_override, portfolio_skill: skill, ai_level: 3, override_level: 4)
    turn = session.transcript_turns.create!(turn_number: 1, speaker: 'candidate', text: 'I use Ruby.')
    allow(gemini_client).to receive(:generate_content).and_return(
      {
        'configured_skills' => [{
          'skill_id' => 'ruby',
          'skill_label' => 'Ruby',
          'level' => 5,
          'confidence' => 'high',
          'evidence' => [turn.text],
          'competency_summary' => 'Synthetic summary.'
        }],
        'discovered_skills' => []
      }
    )

    described_class.new(session:, gemini_client:).call

    expect(skill.reload.ai_level).to eq(5)
    expect(skill.assessor_override.reload).to have_attributes(
      id: override.id,
      ai_level: 5,
      override_level: 4
    )
  end
end
