# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Portfolios::Generator, type: :service do
  # Stub Gemini — never hit the network in unit tests
  let(:gemini_response) do
    {
      'configured_skills' => [
        {
          'skill_id'          => 'SK-ENG-001',
          'skill_label'       => 'Ruby on Rails',
          'level'             => 4,
          'confidence'        => 'high',
          'evidence'          => ['Quote A', 'Quote B', 'Quote C'],
          'competency_summary'=> 'Solid Rails expertise with production experience.'
        }
      ],
      'discovered_skills' => [
        {
          'skill_label'       => 'GraphQL',
          'level'             => 2,
          'confidence'        => 'low',
          'evidence'          => ['Mentioned GraphQL briefly.'],
          'competency_summary'=> 'Basic awareness, not deeply explored.'
        }
      ]
    }
  end

  let(:gemini_client) do
    instance_double(Gemini::HttpClient, generate_content: gemini_response)
  end

  let(:assessment)   { create(:assessment) }
  let(:session) do
    s = create(:session, assessment: assessment)
    create(:assessment_skill,
           assessment:  assessment,
           skill_id:    'SK-ENG-001',
           skill_label: 'Ruby on Rails',
           l1_anchor:   'L1', l2_anchor: 'L2',
           l3_anchor:   'L3', l4_anchor: 'L4', l5_anchor: 'L5')
    create(:coverage_map, session: s, skill_id: 'SK-ENG-001', skill_label: 'Ruby on Rails',
           state: 'covered', probe_count: 4)
    create(:transcript_turn, session: s, speaker: 'candidate', text: 'I built a Rails API.')
    s
  end

  subject(:generator) do
    described_class.new(session: session, gemini_client: gemini_client)
  end

  # ══════════════════════════════════════════════════════════════════════════
  # 1. Happy path — configured skills
  # ══════════════════════════════════════════════════════════════════════════
  describe '#call — configured skills' do
    it 'creates the portfolio with generation_status complete' do
      portfolio = generator.call
      expect(portfolio.generation_status).to eq('complete')
      expect(portfolio.generated_at).not_to be_nil
    end

    it 'persists the configured skill with correct field values' do
      portfolio = generator.call
      skill = portfolio.portfolio_skills.find_by(skill_id: 'SK-ENG-001')

      expect(skill).not_to be_nil
      expect(skill.skill_label).to    eq('Ruby on Rails')
      expect(skill.ai_level).to       eq(4)
      expect(skill.ai_confidence).to  eq('high')
      expect(skill.is_discovered).to  eq(false)
      expect(skill.competency_summary).to eq('Solid Rails expertise with production experience.')
    end

    it 'stores at most 3 evidence quotes' do
      portfolio = generator.call
      skill = portfolio.portfolio_skills.find_by(skill_id: 'SK-ENG-001')
      expect(skill.evidence.length).to be <= 3
    end
  end

  # ══════════════════════════════════════════════════════════════════════════
  # 2. Discovered skills
  # ══════════════════════════════════════════════════════════════════════════
  describe '#call — discovered skills' do
    it 'persists discovered skill with is_discovered true' do
      portfolio = generator.call
      discovered = portfolio.portfolio_skills.find_by(skill_label: 'GraphQL')

      expect(discovered).not_to be_nil
      expect(discovered.is_discovered).to eq(true)
      expect(discovered.skill_id).to be_nil
      expect(discovered.ai_level).to eq(2)
      expect(discovered.ai_confidence).to eq('low')
    end
  end

  # ══════════════════════════════════════════════════════════════════════════
  # 3. ai_level clamping
  # ══════════════════════════════════════════════════════════════════════════
  describe 'ai_level clamping' do
    it 'clamps level above 5 to 5' do
      gemini_response['configured_skills'].first['level'] = 9
      portfolio = generator.call
      expect(portfolio.portfolio_skills.first.ai_level).to eq(5)
    end

    it 'clamps level below 1 to 1' do
      gemini_response['configured_skills'].first['level'] = 0
      portfolio = generator.call
      expect(portfolio.portfolio_skills.first.ai_level).to eq(1)
    end
  end

  # ══════════════════════════════════════════════════════════════════════════
  # 4. Invalid confidence — model validation failure path
  # ══════════════════════════════════════════════════════════════════════════
  describe 'confidence validation' do
    it 'marks portfolio as failed when Gemini returns invalid confidence value' do
      gemini_response['configured_skills'].first['confidence'] = 'ultra-high'

      expect { generator.call }.to raise_error(ActiveRecord::RecordInvalid)

      portfolio = Portfolio.find_by(session_id: session.id)
      expect(portfolio.generation_status).to eq('failed')
      expect(portfolio.generation_error).to be_present
    end
  end

  # ══════════════════════════════════════════════════════════════════════════
  # 5. Idempotency — regeneration destroys old skills and repopulates
  # ══════════════════════════════════════════════════════════════════════════
  describe 'idempotency (re-generation)' do
    it 'replaces old portfolio skills rather than duplicating them' do
      generator.call  # first run
      expect { generator.call }.not_to change(Portfolio, :count)

      portfolio = Portfolio.find_by(session_id: session.id)
      # configured + discovered = 2 skills (not 4 from two runs)
      expect(portfolio.portfolio_skills.count).to eq(2)
    end
  end

  # ══════════════════════════════════════════════════════════════════════════
  # 6. Gemini network failure
  # ══════════════════════════════════════════════════════════════════════════
  describe 'Gemini failure path' do
    before do
      allow(gemini_client).to receive(:generate_content).and_raise(StandardError, 'Gemini timeout')
    end

    it 'marks portfolio as failed' do
      expect { generator.call }.to raise_error(StandardError, 'Gemini timeout')

      portfolio = Portfolio.find_by(session_id: session.id)
      expect(portfolio.generation_status).to eq('failed')
    end

    it 'stores the error message on the portfolio' do
      expect { generator.call }.to raise_error(StandardError)

      portfolio = Portfolio.find_by(session_id: session.id)
      expect(portfolio.generation_error).to include('Gemini timeout')
    end
  end

  # ══════════════════════════════════════════════════════════════════════════
  # 7. Missing keys in Gemini response (edge case)
  # ══════════════════════════════════════════════════════════════════════════
  describe 'edge cases in Gemini response' do
    it 'handles empty configured_skills array gracefully' do
      gemini_response['configured_skills'] = []
      portfolio = generator.call
      expect(portfolio.portfolio_skills.where(is_discovered: false).count).to eq(0)
      expect(portfolio.generation_status).to eq('complete')
    end

    it 'handles missing discovered_skills key gracefully' do
      gemini_response.delete('discovered_skills')
      portfolio = generator.call
      expect(portfolio.portfolio_skills.where(is_discovered: true).count).to eq(0)
    end

    it 'handles nil evidence from Gemini without crashing' do
      gemini_response['configured_skills'].first['evidence'] = nil
      portfolio = generator.call
      skill = portfolio.portfolio_skills.find_by(skill_id: 'SK-ENG-001')
      expect(skill.evidence).to eq([])
    end
  end
end
