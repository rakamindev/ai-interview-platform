# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Portfolios::Generator do
  subject(:generator) { described_class.new(session: session, gemini_client: client) }

  let(:assessment) { create(:assessment, name: 'Backend Engineer') }
  let(:session)    { create(:session, assessment: assessment, status: 'ended') }
  let(:portfolio)  { create(:portfolio, session: session, generation_status: 'pending') }
  let(:client)     { instance_double(Gemini::HttpClient, generate_content: payload) }

  let(:payload) do
    {
      'configured_skills' => [
        {
          'skill_id' => 'sk-001', 'skill_label' => 'Ruby', 'level' => 3,
          'confidence' => 'high', 'evidence' => ['quote one', 'quote two'],
          'competency_summary' => 'Solid Ruby skills.'
        }
      ],
      'discovered_skills' => [
        {
          'skill_label' => 'Async patterns', 'level' => 2,
          'confidence' => 'medium', 'evidence' => ['a discovery'],
          'competency_summary' => 'Growing.'
        }
      ]
    }
  end

  before do
    portfolio # ensure the pending portfolio exists
  end

  describe '#call' do
    it 'generates a complete portfolio with skills and clears the attempt clock' do
      result = generator.call

      expect(result.reload.generation_status).to eq('complete')
      expect(result.reload.generated_at).not_to be_nil
      expect(result.reload.generation_attempted_at).to be_nil
      expect(result.reload.generation_error).to be_nil

      skills = result.reload.portfolio_skills
      expect(skills.size).to eq(2)
      ruby = skills.find_by(skill_label: 'Ruby')
      expect(ruby).to have_attributes(
        is_discovered:  false,
        ai_level:       3,
        ai_confidence:  'high',
        evidence:       ['quote one', 'quote two']
      )
      discovered = skills.find_by(is_discovered: true)
      expect(discovered.skill_label).to eq('Async patterns')
    end

    it 'records generation_attempted_at while running' do
      started = nil
      allow(client).to receive(:generate_content) do
        started = portfolio.reload.generation_attempted_at
        payload
      end

      generator.call

      expect(started).not_to be_nil
    end

    it 'does not run a second Gemini generation when a sibling job is already generating' do
      portfolio.update!(generation_status: 'generating', generation_attempted_at: Time.current)

      expect(client).not_to receive(:generate_content)
      result = generator.call

      expect(result.reload.generation_status).to eq('generating')
    end

    it 'does not run again when the portfolio is already complete' do
      portfolio.update!(generation_status: 'complete', generated_at: Time.current)

      expect(client).not_to receive(:generate_content)
      result = generator.call

      expect(result.reload.generation_status).to eq('complete')
    end

    it 'marks the portfolio failed with a readable error and re-raises on model failure' do
      allow(client).to receive(:generate_content).and_raise(Gemini::HttpClient::ApiError, 'model 500')

      expect { generator.call }.to raise_error(Gemini::HttpClient::ApiError)
      expect(portfolio.reload.generation_status).to eq('failed')
      expect(portfolio.reload.generation_error).to match(/model 500/)
      expect(portfolio.reload.generation_attempted_at).to be_nil
    end

    it 'keeps the previous skills if a skill write fails midway (atomic swap)' do
      portfolio.portfolio_skills.create!(
        skill_label: 'Original skill', ai_level: 2, ai_confidence: 'low',
        competency_summary: 'Original data', evidence: []
      )

      # First skill is valid; second is missing required fields -> create! raises
      bad_payload = {
        'configured_skills' => [
          { 'skill_id' => 'a', 'skill_label' => 'Good skill', 'level' => 3, 'confidence' => 'high', 'evidence' => [], 'competency_summary' => 'ok' },
          { 'skill_data' => 'oops' }
        ],
        'discovered_skills' => []
      }
      allow(client).to receive(:generate_content).and_return(bad_payload)

      expect { generator.call }.to raise_error(ActiveRecord::RecordInvalid)

      expect(portfolio.reload.generation_status).to eq('failed')
      # Original skill must still be intact (transaction rolled back the destroy)
      expect(portfolio.reload.portfolio_skills.map(&:skill_label)).to eq(['Original skill'])
    end
  end
end