# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Portfolios::Generator do
  let(:org) { create(:organization) }
  let(:assessment) { create(:assessment, tenant_id: org.id) }
  let(:session_record) { create(:session, assessment: assessment, tenant_id: org.id) }
  let(:mock_gemini) { instance_double(Gemini::HttpClient) }

  let(:mock_response) do
    {
      'configured_skills' => [
        {
          'skill_id' => 'sk-1',
          'skill_label' => 'Ruby on Rails',
          'level' => 3,
          'confidence' => 'High',
          'evidence' => ['Built REST APIs with ActiveRecord'],
          'competency_summary' => 'Solid mid-level understanding.'
        }
      ],
      'discovered_skills' => [
        {
          'skill_label' => 'Docker',
          'level' => 4,
          'confidence' => ' Medium ',
          'evidence' => ['Configured compose files'],
          'competency_summary' => 'Good container knowledge.'
        }
      ]
    }.to_json
  end

  before do
    allow(mock_gemini).to receive(:generate_content).and_return(mock_response)
  end

  it 'generates a portfolio with skills parsed from Gemini response' do
    generator = described_class.new(session: session_record, gemini_client: mock_gemini)
    portfolio = generator.call

    expect(portfolio.generation_status).to eq('complete')
    expect(portfolio.portfolio_skills.count).to eq(2)

    skill = portfolio.portfolio_skills.find_by(skill_id: 'sk-1')
    expect(skill.skill_id).to eq('sk-1')
    expect(skill.ai_level).to eq(3)
    expect(skill.ai_confidence).to eq('high')

    discovered = portfolio.portfolio_skills.find_by(skill_label: 'Docker')
    expect(discovered.is_discovered).to be true
    expect(discovered.ai_level).to eq(4)
    expect(discovered.ai_confidence).to eq('medium')
  end

  it 'characterizes GAP P1-4: generator executes cleanly even when session transcript is completely empty' do
    expect(session_record.transcript_turns.count).to eq(0)

    generator = described_class.new(session: session_record, gemini_client: mock_gemini)
    portfolio = generator.call

    expect(portfolio.generation_status).to eq('complete')
  end

  context 'when LLM generation encounters an error' do
    it 'records generation_error and re-raises while keeping generation_status generating for retryability' do
      allow(mock_gemini).to receive(:generate_content).and_raise(Gemini::HttpClient::RateLimitError.new('Rate limited'))
      generator = described_class.new(session: session_record, gemini_client: mock_gemini)

      expect { generator.call }.to raise_error(Gemini::HttpClient::RateLimitError, 'Rate limited')

      portfolio = session_record.reload.portfolio
      expect(portfolio.generation_status).to eq('generating')
      expect(portfolio.generation_error).to eq('Rate limited')
    end

    it 'clears generation_error on subsequent successful generation' do
      create(:portfolio, session: session_record, candidate_id: session_record.candidate_id, generation_status: 'generating', generation_error: 'Previous attempt failed')
      generator = described_class.new(session: session_record, gemini_client: mock_gemini)

      result = generator.call

      expect(result.generation_status).to eq('complete')
      expect(result.generation_error).to be_nil
    end
  end
end
