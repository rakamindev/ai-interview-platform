# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Portfolios::Generator, type: :service do
  let!(:org) { create(:organization) }

  def build_generator(session, response)
    gemini = instance_double(Gemini::HttpClient, generate_content: response)
    Portfolios::Generator.new(session: session, gemini_client: gemini)
  end

  def prepared_session
    in_tenant(org) do
      assessment = create(:assessment)
      skill = create(:assessment_skill, assessment: assessment, skill_id: 'SK-ENG-001')
      session = create(:session, assessment: assessment, status: 'ended')
      create(:coverage_map, session: session, skill_id: skill.skill_id, skill_label: skill.skill_label)
      portfolio = create(:portfolio, session: session)
      [session, portfolio]
    end
  end

  describe 'AI output sanitization' do
    it 'clamps levels to 1..5 and coerces invalid confidence to low' do
      session, portfolio = prepared_session
      response = {
        'configured_skills' => [
          {
            'skill_id' => 'SK-ENG-001',
            'skill_label' => 'React',
            'level' => 99,
            'confidence' => 'superb',
            'evidence' => ['a', 'b', 'c', 'd'],
            'competency_summary' => 'Solid.'
          }
        ]
      }

      in_tenant(org) { build_generator(session, response).call }

      skill = portfolio.reload.portfolio_skills.first
      expect(skill.ai_level).to eq(5)
      expect(skill.ai_confidence).to eq('low')
      expect(skill.evidence).to eq(%w[a b c])
    end

    it 'skips malformed skills instead of failing the whole portfolio' do
      session, portfolio = prepared_session
      response = {
        'configured_skills' => [
          { 'skill_label' => nil, 'level' => 3, 'confidence' => 'high', 'competency_summary' => 'x' },
          { 'skill_id' => 'SK-ENG-001', 'skill_label' => 'React', 'level' => 3, 'confidence' => 'high', 'competency_summary' => 'Solid.' },
          { 'skill_label' => 'Broken', 'level' => 'abc', 'confidence' => 'high', 'competency_summary' => 'x' }
        ]
      }

      in_tenant(org) { build_generator(session, response).call }

      expect(portfolio.reload.portfolio_skills.pluck(:skill_label)).to contain_exactly('React')
    end

    it 'marks the portfolio failed when the AI returns no usable configured skills' do
      session, portfolio = prepared_session
      response = { 'configured_skills' => [], 'discovered_skills' => [] }

      expect do
        in_tenant(org) { build_generator(session, response).call }
      end.to raise_error(Portfolios::Generator::GenerationError)

      expect(portfolio.reload.generation_status).not_to eq('complete')
    end

    it 'raises a clean GenerationError for non-JSON responses instead of a parser crash' do
      session, portfolio = prepared_session

      expect do
        in_tenant(org) { build_generator(session, 'definitely not json {').call }
      end.to raise_error(Portfolios::Generator::GenerationError)
    end

    it 'saves discovered skills without a skill_id' do
      session, portfolio = prepared_session
      response = {
        'configured_skills' => [
          { 'skill_id' => 'SK-ENG-001', 'skill_label' => 'React', 'level' => 3, 'confidence' => 'high', 'competency_summary' => 'Solid.' }
        ],
        'discovered_skills' => [
          { 'skill_label' => 'Micro-frontends', 'level' => 2, 'confidence' => 'low', 'evidence' => ['mfe'], 'competency_summary' => 'Brief.' }
        ]
      }

      in_tenant(org) { build_generator(session, response).call }

      discovered = portfolio.reload.portfolio_skills.find_by(skill_label: 'Micro-frontends')
      expect(discovered).to be_present
      expect(discovered.is_discovered).to be(true)
      expect(discovered.skill_id).to be_nil
    end
  end
end