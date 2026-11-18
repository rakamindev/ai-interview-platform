# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Portfolios::Generator do
  let(:org) { Organization.find_or_create_by!(id: 1, name: 'Test Corp', scheme: 'test-corp', identifier: 'test-corp', host: 'localhost') }
  let(:assessment) do
    Current.organization = org
    Current.tenant_id = org.id
    a = Assessment.create!(name: 'Frontend Lead', time_limit_min: 45, created_by: 1)
    a.assessment_skills.create!(skill_label: 'React', l1_anchor: 'L1', l2_anchor: 'L2', l3_anchor: 'L3', l4_anchor: 'L4', l5_anchor: 'L5', display_order: 1)
    a.assessment_skills.create!(skill_label: 'Architecture', l1_anchor: 'L1', l2_anchor: 'L2', l3_anchor: 'L3', l4_anchor: 'L4', l5_anchor: 'L5', display_order: 2)
    a
  end
  let(:session_record) do
    Current.organization = org
    Current.tenant_id = org.id
    s = Session.create!(assessment: assessment, tenant_id: org.id)
    s.coverage_maps.create!(skill_label: 'React', state: 'covered', probe_count: 4)
    s.coverage_maps.create!(skill_label: 'Architecture', state: 'not_yet', probe_count: 0)
    s
  end

  before do
    Current.organization = org
    Current.tenant_id = org.id
  end

  context 'when session has no candidate turns' do
    it 'generates unassessed skills directly without calling Gemini' do
      mock_gemini = double('GeminiClient')
      expect(mock_gemini).not_to receive(:generate_content)

      generator = described_class.new(session: session_record, gemini_client: mock_gemini)
      portfolio = generator.call

      expect(portfolio.generation_status).to eq('complete')
      expect(portfolio.portfolio_skills.count).to eq(2)
      expect(portfolio.portfolio_skills.all? { |s| s.ai_level.nil? && !s.is_assessed? }).to be(true)
    end
  end

  context 'when session has candidate dialogue' do
    before do
      session_record.transcript_turns.create!(turn_number: 1, speaker: 'ai', text: 'Tell me about React')
      session_record.transcript_turns.create!(turn_number: 2, speaker: 'candidate', text: 'I built component libraries with memoization')
    end

    let(:gemini_response) do
      {
        'configured_skills' => [
          {
            'skill_label' => 'React',
            'level' => 3,
            'confidence' => 'high',
            'evidence' => ['built component libraries'],
            'competency_summary' => 'Experienced with React'
          },
          {
            'skill_label' => 'Architecture',
            'level' => nil,
            'confidence' => 'low',
            'evidence' => [],
            'competency_summary' => 'Not assessed'
          }
        ],
        'discovered_skills' => []
      }
    end

    it 'creates assessed skills and preserves unassessed state correctly without forcing L1' do
      mock_gemini = double('GeminiClient', generate_content: gemini_response)

      generator = described_class.new(session: session_record, gemini_client: mock_gemini)
      portfolio = generator.call

      react = portfolio.portfolio_skills.find_by(skill_label: 'React')
      expect(react.ai_level).to eq(3)
      expect(react.is_assessed?).to be(true)
      expect(react.ai_confidence).to eq('high')

      arch = portfolio.portfolio_skills.find_by(skill_label: 'Architecture')
      expect(arch.ai_level).to be_nil
      expect(arch.is_assessed?).to be(false)
      expect(arch.ai_confidence).to eq('low')
    end

    it 'preserves assessor overrides across portfolio regeneration' do
      mock_gemini = double('GeminiClient', generate_content: gemini_response)

      generator = described_class.new(session: session_record, gemini_client: mock_gemini)
      portfolio = generator.call

      react = portfolio.portfolio_skills.find_by(skill_label: 'React')
      react.create_assessor_override!(
        ai_level: 3,
        override_level: 4,
        assessor_notes: 'Demonstrated L4 leadership in discussion',
        overridden_by: 1
      )

      # Now trigger regeneration
      generator_again = described_class.new(session: session_record.reload, gemini_client: mock_gemini)
      reloaded_portfolio = generator_again.call

      reloaded_react = reloaded_portfolio.portfolio_skills.find_by(skill_label: 'React')
      expect(reloaded_react.assessor_override).to be_present
      expect(reloaded_react.assessor_override.override_level).to eq(4)
      expect(reloaded_react.assessor_override.assessor_notes).to eq('Demonstrated L4 leadership in discussion')
      expect(reloaded_react.effective_level).to eq(4)
    end
  end
end
