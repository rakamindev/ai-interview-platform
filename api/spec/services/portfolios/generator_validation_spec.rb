# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Portfolios::Generator Payload Validation', type: :service do
  let!(:org) { Organization.create!(id: 120, scheme: 'test-org', name: 'Test Org', identifier: 'test-org', host: 'localhost') }
  let!(:assessment) { Assessment.unscoped.create!(tenant_id: org.id, name: 'Validation Assessment', created_by: 1, time_limit_min: 30) }
  let!(:skill_config_1) do
    assessment.assessment_skills.create!(
      skill_id: 'SK-ENG-001',
      skill_label: 'React / Frontend Development',
      display_order: 1,
      l1_anchor: 'L1', l2_anchor: 'L2', l3_anchor: 'L3', l4_anchor: 'L4', l5_anchor: 'L5'
    )
  end
  let!(:skill_config_2) do
    assessment.assessment_skills.create!(
      skill_id: 'SK-ENG-002',
      skill_label: 'Node.js / Backend Development',
      display_order: 2,
      l1_anchor: 'L1', l2_anchor: 'L2', l3_anchor: 'L3', l4_anchor: 'L4', l5_anchor: 'L5'
    )
  end

  let!(:session) { Session.unscoped.create!(tenant_id: org.id, assessment_id: assessment.id, candidate_id: 401, status: 'ended') }
  let!(:portfolio) { session.create_portfolio!(candidate_id: session.candidate_id, generation_status: 'pending') }
  let(:mock_gemini_client) { instance_double(Gemini::HttpClient) }

  def valid_skill_payload(skill_id, label, level: 3, confidence: 'high')
    {
      'skill_id' => skill_id,
      'skill_label' => label,
      'level' => level,
      'confidence' => confidence,
      'evidence' => ['Quote 1'],
      'competency_summary' => 'Solid performance.'
    }
  end

  describe 'Strict Level and Schema Validation (AI-AC-01 through AI-AC-05)' do
    it '14 & 15. Missing or null level is rejected and fails generation without saving L1' do
      payload = {
        'configured_skills' => [
          valid_skill_payload('SK-ENG-001', 'React / Frontend Development', level: nil),
          valid_skill_payload('SK-ENG-002', 'Node.js / Backend Development', level: 3)
        ],
        'discovered_skills' => []
      }
      allow(mock_gemini_client).to receive(:generate_content).and_return(payload)

      generator = Portfolios::Generator.new(session: session, gemini_client: mock_gemini_client)
      expect { generator.call }.to raise_error(Portfolios::Generator::ValidationError, /Level must be an integer between 1 and 5/)

      portfolio.reload
      expect(portfolio.generation_status).to eq('failed')
      expect(portfolio.portfolio_skills.count).to eq(0)
    end

    it '16. Invalid level types and out-of-range numbers (string, decimal, bool, 0, -1, 6) are rejected' do
      invalid_levels = ['L3', 3.5, true, false, 0, -1, 6]

      invalid_levels.each do |invalid_level|
        payload = {
          'configured_skills' => [
            valid_skill_payload('SK-ENG-001', 'React / Frontend Development', level: invalid_level),
            valid_skill_payload('SK-ENG-002', 'Node.js / Backend Development', level: 3)
          ],
          'discovered_skills' => []
        }
        allow(mock_gemini_client).to receive(:generate_content).and_return(payload)

        generator = Portfolios::Generator.new(session: session, gemini_client: mock_gemini_client)
        expect { generator.call }.to raise_error(Portfolios::Generator::ValidationError, /Level must be an integer between 1 and 5/)
        expect(portfolio.reload.portfolio_skills.count).to eq(0)
      end
    end

    it '17. Invalid confidence value is rejected' do
      payload = {
        'configured_skills' => [
          valid_skill_payload('SK-ENG-001', 'React / Frontend Development', confidence: 'extreme'),
          valid_skill_payload('SK-ENG-002', 'Node.js / Backend Development', confidence: 'high')
        ],
        'discovered_skills' => []
      }
      allow(mock_gemini_client).to receive(:generate_content).and_return(payload)

      generator = Portfolios::Generator.new(session: session, gemini_client: mock_gemini_client)
      expect { generator.call }.to raise_error(Portfolios::Generator::ValidationError, /Confidence must be one of/)
      expect(portfolio.reload.portfolio_skills.count).to eq(0)
    end

    it '18. Missing configured skills are rejected' do
      # Only SK-ENG-001 returned, SK-ENG-002 omitted
      payload = {
        'configured_skills' => [
          valid_skill_payload('SK-ENG-001', 'React / Frontend Development')
        ],
        'discovered_skills' => []
      }
      allow(mock_gemini_client).to receive(:generate_content).and_return(payload)

      generator = Portfolios::Generator.new(session: session, gemini_client: mock_gemini_client)
      expect { generator.call }.to raise_error(Portfolios::Generator::ValidationError, /Missing configured skills/)
      expect(portfolio.reload.portfolio_skills.count).to eq(0)
    end

    it '19. Duplicate configured skill IDs are rejected' do
      payload = {
        'configured_skills' => [
          valid_skill_payload('SK-ENG-001', 'React / Frontend Development'),
          valid_skill_payload('SK-ENG-001', 'React / Frontend Development'),
          valid_skill_payload('SK-ENG-002', 'Node.js / Backend Development')
        ],
        'discovered_skills' => []
      }
      allow(mock_gemini_client).to receive(:generate_content).and_return(payload)

      generator = Portfolios::Generator.new(session: session, gemini_client: mock_gemini_client)
      expect { generator.call }.to raise_error(Portfolios::Generator::ValidationError, /Duplicate skill_id/)
      expect(portfolio.reload.portfolio_skills.count).to eq(0)
    end

    it '20. Unknown configured skill IDs are rejected' do
      payload = {
        'configured_skills' => [
          valid_skill_payload('SK-ENG-001', 'React / Frontend Development'),
          valid_skill_payload('SK-UNRECOGNIZED-999', 'Unknown Skill')
        ],
        'discovered_skills' => []
      }
      allow(mock_gemini_client).to receive(:generate_content).and_return(payload)

      generator = Portfolios::Generator.new(session: session, gemini_client: mock_gemini_client)
      expect { generator.call }.to raise_error(Portfolios::Generator::ValidationError, /Unknown skill_id/)
      expect(portfolio.reload.portfolio_skills.count).to eq(0)
    end
  end
end
