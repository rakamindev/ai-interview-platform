# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Portfolios::Generator, type: :model do
  let(:session) { create(:session, :ended) }
  let(:mock_client) { instance_double(Gemini::HttpClient) }
  let(:generator) { described_class.new(session: session, gemini_client: mock_client) }

  before do
    with_tenant
    create_list(:assessment_skill, 2, assessment: session.assessment)
    create_list(:coverage_map, 2, session: session)
    create_list(:transcript_turn, 3, session: session)
  end

  describe '#call' do
    let(:mock_response) do
      {
        'configured_skills' => [
          {
            'skill_id' => 'SK-ENG-001',
            'skill_label' => 'React',
            'level' => 3,
            'confidence' => 'high',
            'evidence' => ['Quote 1', 'Quote 2'],
            'competency_summary' => 'Good React skills.'
          }
        ],
        'discovered_skills' => [
          {
            'skill_label' => 'GraphQL',
            'level' => 2,
            'confidence' => 'medium',
            'evidence' => ['Quote 1'],
            'competency_summary' => 'Basic GraphQL knowledge.'
          }
        ]
      }
    end

    before do
      allow(mock_client).to receive(:generate_content).and_return(mock_response)
    end

    it 'creates portfolio if not exists' do
      expect { generator.call }.to change(Portfolio, :count).by(1)
    end

    it 'returns the portfolio' do
      portfolio = generator.call
      expect(portfolio).to be_a(Portfolio)
      expect(portfolio.session).to eq(session)
    end

    it 'sets generation_status to complete' do
      portfolio = generator.call
      expect(portfolio.complete?).to be true
    end

    it 'creates portfolio skills' do
      portfolio = generator.call
      expect(portfolio.portfolio_skills.count).to eq(2)
    end

    it 'sets skill attributes correctly' do
      portfolio = generator.call
      react = portfolio.portfolio_skills.find_by(skill_label: 'React')
      expect(react.ai_level).to eq(3)
      expect(react.ai_confidence).to eq('high')
      expect(react.is_discovered).to be false
    end

    it 'marks discovered skills' do
      portfolio = generator.call
      graphql = portfolio.portfolio_skills.find_by(skill_label: 'GraphQL')
      expect(graphql.is_discovered).to be true
      expect(graphql.skill_id).to be_nil
    end

    it 'clamps level to 1..5' do
      bad_response = mock_response.dup
      bad_response['configured_skills'].first['level'] = 10
      allow(mock_client).to receive(:generate_content).and_return(bad_response)
      portfolio = generator.call
      expect(portfolio.portfolio_skills.first.ai_level).to eq(5)
    end

    it 'limits evidence to 3 items' do
      long_evidence = (1..10).map { |i| "Quote #{i}" }
      bad_response = mock_response.dup
      bad_response['configured_skills'].first['evidence'] = long_evidence
      allow(mock_client).to receive(:generate_content).and_return(bad_response)
      portfolio = generator.call
      expect(portfolio.portfolio_skills.first.evidence.size).to eq(3)
    end

    it 'idempotent - destroys existing skills on regenerate' do
      generator.call
      allow(mock_client).to receive(:generate_content).and_return(
        'configured_skills' => [],
        'discovered_skills' => []
      )
      generator.call
      portfolio = session.reload.portfolio
      expect(portfolio.portfolio_skills.count).to eq(0)
    end
  end

  describe '#build_prompt' do
    it 'includes assessment name' do
      prompt = generator.send(:build_prompt)
      expect(prompt).to include(session.assessment.name)
    end

    it 'includes skill definitions' do
      prompt = generator.send(:build_prompt)
      session.assessment.assessment_skills.each do |skill|
        expect(prompt).to include(skill.skill_label)
      end
    end

    it 'includes transcript' do
      prompt = generator.send(:build_prompt)
      expect(prompt).to include('FULL INTERVIEW TRANSCRIPT')
    end

    it 'includes coverage map' do
      prompt = generator.send(:build_prompt)
      expect(prompt).to include('FINAL COVERAGE MAP')
    end
  end

  describe '#coverage_json' do
    it 'formats coverage map correctly' do
      map = create(:coverage_map, session: session, skill_label: 'React', state: 'partial', probe_count: 2)
      json = generator.send(:coverage_json, map)
      expect(json[:label]).to eq('React')
      expect(json[:state]).to eq('partial')
      expect(json[:probe_count]).to eq(2)
    end
  end

  describe 'error handling' do
    it 'marks portfolio as failed on error' do
      allow(mock_client).to receive(:generate_content).and_raise(StandardError.new('API error'))
      expect { generator.call }.to raise_error(StandardError)
      portfolio = session.reload.portfolio
      expect(portfolio.failed?).to be true
      expect(portfolio.generation_error).to eq('API error')
    end
  end
end