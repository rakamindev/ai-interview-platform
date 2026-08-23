# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Portfolios::Generator do
  let(:organization) { create(:organization) }
  let(:assessment) { create(:assessment, tenant_id: organization.id) }
  let(:session) { create(:session, :active, assessment: assessment, tenant_id: organization.id) }

  let(:mock_gemini) do
    instance_double(
      Gemini::HttpClient,
      generate_content: {
        'configured_skills' => [
          {
            'skill_id' => 'sk-01',
            'skill_label' => 'React Core',
            'level' => 3,
            'confidence' => 'high',
            'evidence' => ['Used React hooks cleanly.'],
            'competency_summary' => 'Solid React foundation.'
          }
        ],
        'discovered_skills' => [
          {
            'skill_label' => 'System Design',
            'level' => 4,
            'confidence' => 'medium',
            'evidence' => ['Explained event-driven queues.'],
            'competency_summary' => 'Good distributed systems knowledge.'
          }
        ]
      }
    )
  end

  subject { described_class.new(session: session, gemini_client: mock_gemini) }

  describe '#call' do
    it 'creates a complete portfolio with configured and discovered skills' do
      portfolio = subject.call

      expect(portfolio).to be_persisted
      expect(portfolio.generation_status).to eq('complete')
      expect(portfolio.portfolio_skills.count).to eq(2)

      configured = portfolio.portfolio_skills.find_by(skill_label: 'React Core')
      expect(configured).to be_present
      expect(configured.is_discovered).to eq(false)
      expect(configured.ai_level).to eq(3)
      expect(configured.ai_confidence).to eq('high')

      discovered = portfolio.portfolio_skills.find_by(skill_label: 'System Design')
      expect(discovered).to be_present
      expect(discovered.is_discovered).to eq(true)
      expect(discovered.ai_level).to eq(4)
    end

    it 'performs atomic skill writes and rolls back cleanly on invalid skill data' do
      portfolio = session.create_portfolio!(
        candidate_id: session.candidate_id,
        generation_status: 'complete'
      )
      portfolio.portfolio_skills.create!(
        skill_label: 'Existing Skill',
        ai_level: 3,
        ai_confidence: 'high',
        evidence: ['Initial quote'],
        competency_summary: 'Existing summary'
      )

      bad_gemini = instance_double(
        Gemini::HttpClient,
        generate_content: {
          'configured_skills' => [
            { 'skill_label' => '', 'level' => 3, 'confidence' => 'high' }
          ]
        }
      )

      generator = described_class.new(session: session, gemini_client: bad_gemini)

      expect { generator.call }.to raise_error(ActiveRecord::RecordInvalid)

      portfolio.reload
      expect(portfolio.generation_status).to eq('failed')
      expect(portfolio.portfolio_skills.pluck(:skill_label)).to eq(['Existing Skill'])
    end
  end
end
