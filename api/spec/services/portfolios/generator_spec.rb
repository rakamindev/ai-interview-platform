# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Portfolios::Generator do
  let(:assessment) { create(:assessment, name: 'Backend Dev') }
  let(:session) { create(:session, assessment: assessment) }
  let(:gemini_client) { instance_double('Gemini::HttpClient') }
  let(:generator) { described_class.new(session: session, gemini_client: gemini_client) }

  before do
    allow(Gemini::HttpClient).to receive(:new).and_return(gemini_client)
  end

  describe '#call' do
    let(:api_response) do
      {
        'configured_skills' => [
          {
            'skill_id' => 's1',
            'skill_label' => 'Ruby',
            'level' => 4,
            'confidence' => 'high',
            'evidence' => ['quote 1'],
            'competency_summary' => 'Good at Ruby.'
          }
        ],
        'discovered_skills' => [
          {
            'skill_label' => 'Docker',
            'level' => 3,
            'confidence' => 'medium',
            'evidence' => ['quote 2'],
            'competency_summary' => 'Knows Docker.'
          }
        ]
      }.to_json
    end

    before do
      allow(gemini_client).to receive(:generate_content).and_return(api_response)
      create(:assessment_skill, assessment: assessment, skill_id: 's1', skill_label: 'Ruby')
      create(:coverage_map, session: session, skill_id: 's1', skill_label: 'Ruby', state: 'covered', is_discovered: false)
      create(:transcript_turn, session: session, speaker: 'candidate', text: 'I write ruby.')
    end

    it 'creates a portfolio if none exists' do
      expect { generator.call }.to change(Portfolio, :count).by(1)
      
      portfolio = session.reload.portfolio
      expect(portfolio.generation_status).to eq('complete')
      expect(portfolio.generated_at).to be_present
    end

    it 'generates portfolio skills correctly' do
      portfolio = generator.call
      expect(portfolio.portfolio_skills.count).to eq(2)
      
      configured = portfolio.portfolio_skills.find_by(is_discovered: false)
      expect(configured.skill_id).to eq('s1')
      expect(configured.skill_label).to eq('Ruby')
      expect(configured.ai_level).to eq(4)
      expect(configured.ai_confidence).to eq('high')
      expect(configured.competency_summary).to eq('Good at Ruby.')

      discovered = portfolio.portfolio_skills.find_by(is_discovered: true)
      expect(discovered.skill_id).to be_nil
      expect(discovered.skill_label).to eq('Docker')
      expect(discovered.ai_level).to eq(3)
    end

    it 'is idempotent for existing skills' do
      portfolio = create(:portfolio, session: session)
      create(:portfolio_skill, portfolio: portfolio, skill_label: 'Old Skill')

      expect { generator.call }.to change(PortfolioSkill, :count).from(1).to(2)
      expect(portfolio.portfolio_skills.pluck(:skill_label)).to contain_exactly('Ruby', 'Docker')
    end

    context 'when generation fails' do
      before do
        allow(gemini_client).to receive(:generate_content).and_raise(StandardError, 'Generation failed')
      end

      it 'marks the portfolio as failed and raises error' do
        expect { generator.call }.to raise_error(StandardError, 'Generation failed')
        expect(session.reload.portfolio.generation_status).to eq('failed')
        expect(session.portfolio.generation_error).to eq('Generation failed')
      end
    end
  end
end
