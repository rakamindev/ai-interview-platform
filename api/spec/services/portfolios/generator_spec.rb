# frozen_string_literal: true

require_relative '../../../app/services/portfolios/generator'

RSpec.describe Portfolios::Generator do
  let(:session) { double('Session') }
  let(:gemini_client) { double('GeminiClient') }
  let(:portfolio) { double('Portfolio') }
  let(:portfolio_skills) { double('PortfolioSkillsAssociation') }
  let(:candidate_turns) do
    [double('TranscriptTurn', text: 'I led a Redux Toolkit migration across the frontend team.')]
  end
  let(:created_attributes) { [] }

  subject(:generator) { described_class.new(session: session, gemini_client: gemini_client) }

  before do
    allow(portfolio).to receive(:portfolio_skills).and_return(portfolio_skills)
    allow(portfolio_skills).to receive(:includes).with(:assessor_override).and_return([])
    allow(portfolio_skills).to receive(:destroy_all)
    allow(portfolio_skills).to receive(:create!) do |attributes|
      created_attributes << attributes
      double('PortfolioSkill', skill_id: attributes[:skill_id], skill_label: attributes[:skill_label])
    end
  end

  describe 'evidence grounding' do
    it 'rejects hallucinated evidence and resets the skill to the evidence-free baseline' do
      response = {
        'configured_skills' => [
          {
            'skill_id' => 'react',
            'skill_label' => 'React / Frontend Development',
            'level' => 4,
            'confidence' => 'high',
            'evidence' => ['I designed a distributed system used by millions of users.'],
            'competency_summary' => 'This summary is unsupported by the transcript.'
          }
        ],
        'discovered_skills' => [
          {
            'skill_label' => 'Distributed Systems',
            'level' => 5,
            'confidence' => 'high',
            'evidence' => ['I designed a distributed system used by millions of users.'],
            'competency_summary' => 'This skill was hallucinated.'
          }
        ]
      }

      generator.send(:save_skills, portfolio, response, candidate_turns)

      expect(created_attributes).to contain_exactly(
        hash_including(
          skill_id: 'react',
          evidence: [],
          ai_level: 1,
          ai_confidence: 'low',
          competency_summary: 'Insufficient directly attributable candidate evidence was recorded for this skill.'
        )
      )
    end

    it 'keeps transcript-grounded evidence and permits discovered skills only when supported' do
      grounded_quote = 'I led a Redux Toolkit migration across the frontend team.'
      response = {
        'configured_skills' => [
          {
            'skill_id' => 'react',
            'skill_label' => 'React / Frontend Development',
            'level' => 4,
            'confidence' => 'high',
            'evidence' => [grounded_quote],
            'competency_summary' => 'The candidate described leading a frontend migration.'
          }
        ],
        'discovered_skills' => [
          {
            'skill_label' => 'State Management',
            'level' => 3,
            'confidence' => 'medium',
            'evidence' => [grounded_quote],
            'competency_summary' => 'The candidate demonstrated state-management experience.'
          }
        ]
      }

      generator.send(:save_skills, portfolio, response, candidate_turns)

      expect(created_attributes).to contain_exactly(
        hash_including(
          skill_id: 'react',
          evidence: [grounded_quote],
          ai_level: 4,
          ai_confidence: 'high'
        ),
        hash_including(
          skill_id: nil,
          skill_label: 'State Management',
          evidence: [grounded_quote],
          ai_level: 3
        )
      )
    end
  end
end
