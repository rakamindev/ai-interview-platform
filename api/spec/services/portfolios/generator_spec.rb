# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Portfolios::Generator do
  let(:assessment) { create(:assessment) }
  let(:askill_1) { create(:assessment_skill, assessment: assessment, skill_label: 'React Core', expected_level: 3) }
  let(:askill_2) { create(:assessment_skill, assessment: assessment, skill_label: 'Communication', expected_level: 3) }
  let(:session) { create(:session, assessment: assessment, status: 'ended') }
  let(:mock_gemini) { instance_double(Gemini::HttpClient) }

  before do
    askill_1
    askill_2
    create(:coverage_map, session: session, skill_label: 'React Core', state: 'covered', probe_count: 3)
    create(:coverage_map, session: session, skill_label: 'Communication', state: 'covered', probe_count: 2)
  end

  subject(:generator) { described_class.new(session: session, gemini_client: mock_gemini) }

  describe '#call' do
    context 'when Gemini returns valid JSON payload' do
      let(:gemini_response) do
        {
          'configured_skills' => [
            {
              'skill_id' => askill_1.skill_id,
              'skill_label' => 'React Core',
              'level' => 'L3',
              'confidence' => 'HIGH',
              'evidence' => ['Refactored state using context splitting', 'Reduced initial bundle size by 60%'],
              'competency_summary' => 'Demonstrates solid L3 proficiency in React architecture.'
            },
            {
              'skill_id' => askill_2.skill_id,
              'skill_label' => 'Communication',
              'level' => 2,
              'confidence' => 'medium',
              'evidence' => ['Documented design choices in RFC'],
              'competency_summary' => 'Communicates clearly within the direct engineering team.'
            }
          ],
          'discovered_skills' => [
            {
              'skill_label' => 'Micro-frontends',
              'level' => '2',
              'confidence' => 'low',
              'evidence' => ['Split monolithic app with Module Federation'],
              'competency_summary' => 'Hands-on experience with micro-frontend architecture.'
            }
          ]
        }
      end

      before do
        allow(mock_gemini).to receive(:generate_content).and_return(gemini_response)
      end

      it 'creates a complete portfolio with normalized levels and confidences' do
        portfolio = generator.call

        expect(portfolio.generation_status).to eq('complete')
        expect(portfolio.generated_at).to be_present
        expect(portfolio.portfolio_skills.count).to eq(3)

        react_skill = portfolio.portfolio_skills.find_by(skill_label: 'React Core')
        expect(react_skill.ai_level).to eq(3) # "L3" normalized to 3
        expect(react_skill.ai_confidence).to eq('high') # "HIGH" normalized to "high"
        expect(react_skill.evidence_quotes.size).to eq(2)
        expect(react_skill.is_discovered).to be false

        discovered = portfolio.portfolio_skills.find_by(skill_label: 'Micro-frontends')
        expect(discovered.is_discovered).to be true
        expect(discovered.ai_level).to eq(2)
        expect(discovered.ai_confidence).to eq('low')
      end
    end

    context 'when Gemini returns markdown wrapped JSON string' do
      let(:markdown_response) do
        <<~JSON
          ```json
          {
            "configured_skills": [
              {
                "skill_label": "React Core",
                "level": "3",
                "confidence": "high",
                "evidence": ["Great quote"],
                "competency_summary": "Solid architecture knowledge."
              }
            ]
          }
          ```
        JSON
      end

      before do
        allow(mock_gemini).to receive(:generate_content).and_return(markdown_response)
      end

      it 'parses markdown code blocks safely without failing' do
        portfolio = generator.call
        expect(portfolio.generation_status).to eq('complete')
        expect(portfolio.portfolio_skills.count).to eq(1)
        expect(portfolio.portfolio_skills.first.ai_level).to eq(3)
      end
    end

    context 'when Gemini fails with network timeout or API error' do
      before do
        allow(mock_gemini).to receive(:generate_content).and_raise(
          Gemini::HttpClient::TimeoutError.new('Gemini API timeout after 60s: AIzaSyFakeKey1234567890123456789012345')
        )
      end

      it 'updates portfolio status to failed and redacts sensitive API keys from error message' do
        expect { generator.call }.to raise_error(Gemini::HttpClient::TimeoutError)

        portfolio = session.reload.portfolio
        expect(portfolio.generation_status).to eq('failed')
        expect(portfolio.generation_error).to include('[REDACTED_API_KEY]')
        expect(portfolio.generation_error).not_to include('AIzaSyFakeKey')
      end
    end
  end
end
