# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Portfolios::Generator do
  let(:assessment) { create(:assessment) }
  let!(:skill) { create(:assessment_skill, assessment:, expected_level: 4, display_order: 0, skill_label: 'System Design') }
  let(:session) { create(:session, assessment:, tenant_id: assessment.tenant_id) }
  let!(:portfolio) { create(:portfolio, session:, generation_status: 'pending', generated_at: nil) }
  let(:gemini_client) { instance_double(Gemini::HttpClient) }

  let(:valid_response) do
    {
      'configured_skills' => [{
        'skill_id' => skill.skill_id,
        'skill_label' => skill.skill_label,
        'level' => 4,
        'confidence' => 'high',
        'evidence' => ['I designed the service boundaries and failure recovery plan.'],
        'competency_summary' => 'Demonstrates the expected system-design level with concrete trade-offs.'
      }],
      'discovered_skills' => [],
      'overall_recommendation' => {
        'outcome' => 'pass',
        'rationale' => 'The configured skill meets the expected level with specific evidence from the transcript.'
      }
    }
  end

  it 'captures an AI recommendation atomically with the generated portfolio' do
    allow(gemini_client).to receive(:generate_content).and_return(valid_response)

    result = described_class.new(session:, gemini_client:).call

    expect(result).to be_complete
    expect(result.generation_error).to be_nil
    expect(result.portfolio_decision).to have_attributes(
      ai_outcome: 'pass',
      ai_rationale: valid_response.dig('overall_recommendation', 'rationale')
    )
    expect(result.portfolio_decision.portfolio_decision_events.pluck(:event_type)).to eq(['ai_recommended'])
    expect(result.portfolio_skills.pluck(:ai_level)).to eq([4])
  end

  it 'provides expected levels to the AI and fails safely when the recommendation is absent' do
    generator = described_class.new(session:, gemini_client:)
    expect(generator.send(:build_prompt)).to include('EXPECTED LEVEL: L4')

    allow(gemini_client).to receive(:generate_content).and_return(valid_response.except('overall_recommendation'))

    expect { generator.call }.to raise_error(described_class::InvalidRecommendation, /missing overall_recommendation/)
    expect(portfolio.reload).to be_failed
    expect(portfolio.portfolio_decision).to be_nil
  end
end
