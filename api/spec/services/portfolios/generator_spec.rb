# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Portfolios::Generator do
  let(:organization) { Organization.create!(name: 'Generator Org', scheme: 'genorg', identifier: 'genorg', host: 'genorg.test') }
  let(:assessment) do
    Assessment.create!(
      tenant_id: organization.id,
      created_by: 1,
      name: 'Fullstack Dev',
      time_limit_min: 30
    )
  end
  let(:session) do
    Session.create!(
      tenant_id: organization.id,
      assessment: assessment,
      invite_token: SecureRandom.hex(16),
      status: :ended
    )
  end
  let(:mock_gemini_client) { instance_double(Gemini::HttpClient) }

  subject(:generator) { described_class.new(session: session, gemini_client: mock_gemini_client) }

  describe '#call' do
    it 'preserves nil level for unassessed skills without forcing level 1' do
      mock_response = {
        'configured_skills' => [
          {
            'skill_id' => 'sk-01',
            'skill_label' => 'Ruby on Rails',
            'level' => 3,
            'confidence' => 'high',
            'evidence' => ['writes clean services'],
            'competency_summary' => 'Solid Rails expertise'
          },
          {
            'skill_id' => 'sk-02',
            'skill_label' => 'GraphQL API',
            'level' => nil,
            'confidence' => nil,
            'evidence' => [],
            'competency_summary' => nil
          }
        ],
        'discovered_skills' => []
      }.to_json

      allow(mock_gemini_client).to receive(:generate_content).and_return(mock_response)

      portfolio = generator.call
      skills = portfolio.portfolio_skills.order(:skill_label)

      assessed = skills.find_by(skill_label: 'Ruby on Rails')
      expect(assessed.ai_level).to eq(3)
      expect(assessed.unassessed?).to be false

      unassessed = skills.find_by(skill_label: 'GraphQL API')
      expect(unassessed.ai_level).to be_nil
      expect(unassessed.unassessed?).to be true
      expect(unassessed.competency_summary).to eq('Skill not assessed during interview.')
    end

    it 'preserves assessor overrides across regeneration' do
      initial_portfolio = session.create_portfolio!(generation_status: 'complete')
      skill = initial_portfolio.portfolio_skills.create!(
        skill_id: 'sk-01',
        skill_label: 'Ruby on Rails',
        ai_level: 2,
        ai_confidence: 'medium',
        competency_summary: 'Initial summary'
      )

      skill.create_assessor_override!(
        ai_level: 2,
        override_level: 4,
        assessor_notes: 'Candidate demonstrated L4 system design during manual code review',
        overridden_by: 12
      )

      mock_response = {
        'configured_skills' => [
          {
            'skill_id' => 'sk-01',
            'skill_label' => 'Ruby on Rails',
            'level' => 3,
            'confidence' => 'high',
            'evidence' => ['new evidence quote'],
            'competency_summary' => 'Updated AI evaluation'
          }
        ],
        'discovered_skills' => []
      }.to_json

      allow(mock_gemini_client).to receive(:generate_content).and_return(mock_response)

      updated_portfolio = generator.call
      reloaded_skill = updated_portfolio.portfolio_skills.find_by(skill_id: 'sk-01')

      expect(reloaded_skill.id).to eq(skill.id)
      expect(reloaded_skill.ai_level).to eq(3)
      expect(reloaded_skill.competency_summary).to eq('Updated AI evaluation')
      expect(reloaded_skill.assessor_override).to be_present
      expect(reloaded_skill.assessor_override.override_level).to eq(4)
      expect(reloaded_skill.assessor_override.assessor_notes).to include('Candidate demonstrated L4')
    end

    it 'parses string payload wrapped in markdown code blocks' do
      fenced_response = <<~FENCED
        ```json
        {
          "configured_skills": [
            {
              "skill_id": "sk-01",
              "skill_label": "Ruby on Rails",
              "level": 4,
              "confidence": "high",
              "evidence": ["designed architectural patterns"],
              "competency_summary": "Expert level Rails developer"
            }
          ],
          "discovered_skills": []
        }
        ```
      FENCED

      allow(mock_gemini_client).to receive(:generate_content).and_return(fenced_response)

      portfolio = generator.call
      expect(portfolio.generation_status).to eq('complete')
      skill = portfolio.portfolio_skills.find_by(skill_id: 'sk-01')
      expect(skill.ai_level).to eq(4)
      expect(skill.competency_summary).to eq('Expert level Rails developer')
    end
  end

  describe 'multi-tenant HttpClient initialization (ENH-CFG-02)' do
    it 'passes session tenant organization into Gemini::HttpClient' do
      mock_client = instance_double(Gemini::HttpClient)
      expect(Gemini::HttpClient).to receive(:new).with(
        hash_including(
          organization: organization
        )
      ).and_return(mock_client)

      gen = described_class.new(session: session)
      expect(gen.instance_variable_get(:@gemini_client)).to eq(mock_client)
    end
  end
end
