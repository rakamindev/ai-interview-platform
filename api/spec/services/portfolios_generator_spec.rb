# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Portfolios::Generator, type: :service do
  let(:org) do
    Organization.find_or_create_by!(scheme: 'test-corp') do |o|
      o.name = 'Test Corp'
      o.identifier = 'test-corp'
      o.host = 'localhost'
    end
  end

  let(:assessment) do
    Assessment.create!(
      tenant_id: org.id,
      created_by: 1,
      name: 'Backend Assessment',
      time_limit_min: 30
    )
  end

  let(:session) do
    Session.create!(
      assessment: assessment,
      tenant_id: org.id,
      candidate_name: 'Ahmad Fauzi',
      status: 'ended'
    )
  end

  describe '#call with edge-case LLM response' do
    it 'handles missing/null levels gracefully with low confidence and disclaimer without raising error' do
      # Mock Gemini response with missing level and empty evidence
      gemini_payload = {
        'configured_skills' => [
          {
            'skill_id' => 'SK-ENG-002',
            'skill_label' => 'Node.js / Backend Development',
            'level' => nil, # missing rating
            'confidence' => nil,
            'evidence' => [],
            'competency_summary' => nil
          }
        ],
        'discovered_skills' => [
          {
            'skill_label' => 'GraphQL API Design',
            'level' => 3,
            'confidence' => 'HIGH',
            'evidence' => ['Designed federated GraphQL schema.', ''],
            'competency_summary' => 'Solid GraphQL experience.'
          }
        ]
      }

      fake_gemini = instance_double(Gemini::HttpClient)
      allow(fake_gemini).to receive(:generate_content).and_return(gemini_payload)

      generator = described_class.new(session: session, gemini_client: fake_gemini)
      portfolio = generator.call

      expect(portfolio).to be_persisted
      expect(portfolio.generation_status).to eq('complete')

      node_skill = portfolio.portfolio_skills.find_by(skill_label: 'Node.js / Backend Development')
      graphql_skill = portfolio.portfolio_skills.find_by(skill_label: 'GraphQL API Design')

      expect(node_skill).to be_present
      expect(node_skill.ai_level).to eq(1) # fallback level
      expect(node_skill.ai_confidence).to eq('low')
      expect(node_skill.competency_summary).to include('Insufficient behavioral signal')

      expect(graphql_skill).to be_present
      expect(graphql_skill.is_discovered).to be true
      expect(graphql_skill.ai_level).to eq(3)
      expect(graphql_skill.ai_confidence).to eq('high')
      expect(graphql_skill.evidence).to eq(['Designed federated GraphQL schema.']) # stripped empty string
    end
  end
end
