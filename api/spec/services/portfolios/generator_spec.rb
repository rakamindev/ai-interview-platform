# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Portfolios::Generator, type: :service do
  let(:assessment) { create(:assessment, :with_skills) }
  let(:session) { create(:session, assessment: assessment, status: 'ended') }
  let(:mock_gemini_client) { instance_double(Gemini::HttpClient) }

  let(:valid_llm_response) do
    {
      'configured_skills' => [
        {
          'skill_id' => 'sk-react',
          'skill_label' => 'React / Frontend',
          'level' => 3,
          'confidence' => 'high',
          'evidence' => ['Quote about React hooks', 'Quote about state profiling'],
          'competency_summary' => 'Strong L3 React developer.'
        },
        {
          'skill_id' => 'sk-system-design',
          'skill_label' => 'System Design',
          'level' => 3,
          'confidence' => 'medium',
          'evidence' => ['Quote about scaling'],
          'competency_summary' => 'Solid system design reasoning.'
        }
      ],
      'discovered_skills' => [
        {
          'skill_label' => 'GraphQL API',
          'level' => 2,
          'confidence' => 'low',
          'evidence' => ['Mentioned using GraphQL queries'],
          'competency_summary' => 'Basic familiarity with GraphQL.'
        }
      ]
    }
  end

  before do
    allow(mock_gemini_client).to receive(:generate_content).and_return(valid_llm_response)
  end

  describe '#call' do
    it 'creates a portfolio with configured and discovered skills' do
      generator = described_class.new(session: session, gemini_client: mock_gemini_client)
      portfolio = generator.call

      expect(portfolio).to be_persisted
      expect(portfolio.generation_status).to eq('complete')
      expect(portfolio.portfolio_skills.count).to eq(3)

      react_skill = portfolio.portfolio_skills.find_by(skill_label: 'React / Frontend')
      expect(react_skill).to be_present
      expect(react_skill.ai_level).to eq(3)
      expect(react_skill.ai_confidence).to eq('high')
      expect(react_skill.is_discovered).to be false

      graphql_skill = portfolio.portfolio_skills.find_by(skill_label: 'GraphQL API')
      expect(graphql_skill).to be_present
      expect(graphql_skill.is_discovered).to be true
    end

    it 'preserves human assessor overrides across portfolio regenerations (P0-1 fix)' do
      # 1. Initial generation
      generator = described_class.new(session: session, gemini_client: mock_gemini_client)
      portfolio = generator.call

      react_skill = portfolio.portfolio_skills.find_by(skill_label: 'React / Frontend')
      expect(react_skill.ai_level).to eq(3)

      # 2. Assessor overrides React skill level from 3 to 4 with notes
      override = react_skill.create_assessor_override!(
        ai_level: 3,
        override_level: 4,
        assessor_notes: 'Demonstrated superior architectural depth in follow-up.',
        overridden_by: 99
      )
      expect(override).to be_persisted

      # 3. Regenerate portfolio
      regenerated = generator.call

      expect(regenerated.id).to eq(portfolio.id)
      expect(regenerated.generation_status).to eq('complete')

      # Check that the React skill still has the override intact
      new_react_skill = regenerated.portfolio_skills.find_by(skill_label: 'React / Frontend')
      expect(new_react_skill.assessor_override).to be_present
      expect(new_react_skill.assessor_override.override_level).to eq(4)
      expect(new_react_skill.assessor_override.assessor_notes).to eq(
        'Demonstrated superior architectural depth in follow-up.'
      )
      expect(new_react_skill.assessor_override.overridden_by).to eq(99)
    end

    it 'handles stringified JSON response from Gemini client gracefully' do
      allow(mock_gemini_client).to receive(:generate_content).and_return(valid_llm_response.to_json)

      generator = described_class.new(session: session, gemini_client: mock_gemini_client)
      portfolio = generator.call

      expect(portfolio.generation_status).to eq('complete')
      expect(portfolio.portfolio_skills.count).to eq(3)
    end
  end
end
