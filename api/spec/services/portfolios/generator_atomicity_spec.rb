# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Portfolios::Generator Atomicity and State Transitions', type: :service do
  let!(:org) { Organization.create!(id: 130, scheme: 'test-org', name: 'Test Org', identifier: 'test-org', host: 'localhost') }
  let!(:assessment) { Assessment.unscoped.create!(tenant_id: org.id, name: 'Atomicity Assessment', created_by: 1, time_limit_min: 30) }
  let!(:skill_config_1) do
    assessment.assessment_skills.create!(
      skill_id: 'SK-ENG-001',
      skill_label: 'React / Frontend Development',
      display_order: 1,
      l1_anchor: 'L1', l2_anchor: 'L2', l3_anchor: 'L3', l4_anchor: 'L4', l5_anchor: 'L5'
    )
  end

  let!(:session) { Session.unscoped.create!(tenant_id: org.id, assessment_id: assessment.id, candidate_id: 501, status: 'ended') }
  let!(:portfolio) { session.create_portfolio!(candidate_id: session.candidate_id, generation_status: 'complete', generated_at: 1.hour.ago) }
  let(:mock_gemini_client) { instance_double(Gemini::HttpClient) }

  before do
    portfolio.portfolio_skills.create!(
      skill_id: 'SK-ENG-001',
      skill_label: 'React / Frontend Development',
      ai_level: 3,
      ai_confidence: 'high',
      competency_summary: 'Initial valid summary.',
      evidence: ['Initial Quote 1']
    )
  end

  describe 'Atomic Transactions and Preservation (AI-AC-06 through AI-AC-12)' do
    it '21. Malformed JSON during regeneration does not alter existing skills' do
      allow(mock_gemini_client).to receive(:generate_content).and_return("{ broken_json: invalid")

      generator = Portfolios::Generator.new(session: session, gemini_client: mock_gemini_client)
      expect { generator.call }.to raise_error(Portfolios::Generator::ValidationError, /Malformed JSON/)

      portfolio.reload
      expect(portfolio.portfolio_skills.count).to eq(1)
      expect(portfolio.portfolio_skills.first.competency_summary).to eq('Initial valid summary.')
      expect(portfolio.generation_status).to eq('complete') # preserved complete result with error note
    end

    it '22 & 23. Invalid later skill in batch rolls back completely and preserves existing skills' do
      malformed_batch = {
        'configured_skills' => [
          {
            'skill_id' => 'SK-ENG-001',
            'skill_label' => 'React / Frontend Development',
            'level' => 4,
            'confidence' => 'high',
            'evidence' => ['New Quote'],
            'competency_summary' => 'New Summary'
          }
        ],
        'discovered_skills' => [
          {
            'skill_label' => nil, # triggers failure on discovered skill
            'level' => 2,
            'confidence' => 'low',
            'evidence' => [],
            'competency_summary' => 'Discovered summary'
          }
        ]
      }
      allow(mock_gemini_client).to receive(:generate_content).and_return(malformed_batch)

      generator = Portfolios::Generator.new(session: session, gemini_client: mock_gemini_client)
      expect { generator.call }.to raise_error(Portfolios::Generator::ValidationError, /Discovered skill label cannot be blank/)

      portfolio.reload
      # Preserves previous skills and leaves 0 partial rows
      expect(portfolio.portfolio_skills.count).to eq(1)
      expect(portfolio.portfolio_skills.first.competency_summary).to eq('Initial valid summary.')
      expect(portfolio.generation_status).to eq('complete')
    end

    it '24. Successful generation atomically replaces previous skills' do
      valid_batch = {
        'configured_skills' => [
          {
            'skill_id' => 'SK-ENG-001',
            'skill_label' => 'React / Frontend Development',
            'level' => 4,
            'confidence' => 'high',
            'evidence' => ['Updated Quote'],
            'competency_summary' => 'Updated Summary'
          }
        ],
        'discovered_skills' => []
      }
      allow(mock_gemini_client).to receive(:generate_content).and_return(valid_batch)

      generator = Portfolios::Generator.new(session: session, gemini_client: mock_gemini_client)
      generator.call

      portfolio.reload
      expect(portfolio.portfolio_skills.count).to eq(1)
      expect(portfolio.portfolio_skills.first.ai_level).to eq(4)
      expect(portfolio.portfolio_skills.first.competency_summary).to eq('Updated Summary')
      expect(portfolio.generation_status).to eq('complete')
    end

    it '25. Multiple sequential runs (retries) do not create duplicate skill rows' do
      valid_batch = {
        'configured_skills' => [
          {
            'skill_id' => 'SK-ENG-001',
            'skill_label' => 'React / Frontend Development',
            'level' => 5,
            'confidence' => 'high',
            'evidence' => ['Retry Quote'],
            'competency_summary' => 'Retry Summary'
          }
        ],
        'discovered_skills' => []
      }
      allow(mock_gemini_client).to receive(:generate_content).and_return(valid_batch)

      generator = Portfolios::Generator.new(session: session, gemini_client: mock_gemini_client)
      generator.call
      generator.call

      portfolio.reload
      expect(portfolio.portfolio_skills.count).to eq(1)
      expect(portfolio.portfolio_skills.first.ai_level).to eq(5)
    end
  end
end
