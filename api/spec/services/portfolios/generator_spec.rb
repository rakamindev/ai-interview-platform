# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Portfolios::Generator do
  # Minimal doubles — we don't need a running DB for these unit tests.
  # We test the save_skills logic which is the core of the fix.

  let(:session) { instance_double('Session', id: 1, candidate_id: 42) }
  let(:assessment) { instance_double('Assessment', name: 'Test Assessment') }
  let(:assessment_skills) { double('assessment_skills', order: []) }
  let(:coverage_maps) { double('coverage_maps', order: []) }
  let(:transcript_turns) { double('transcript_turns', ordered: []) }

  let(:portfolio) { instance_double('Portfolio', id: 1, portfolio_skills: portfolio_skills_relation) }
  let(:portfolio_skills_relation) { double('portfolio_skills_relation') }

  let(:gemini_client) { instance_double('Gemini::HttpClient') }

  subject { described_class.new(session: session, gemini_client: gemini_client) }

  before do
    allow(session).to receive(:assessment).and_return(assessment)
    allow(session).to receive(:portfolio).and_return(portfolio)
    allow(session).to receive(:create_portfolio!).and_return(portfolio)
    allow(session).to receive(:coverage_maps).and_return(coverage_maps)
    allow(session).to receive(:transcript_turns).and_return(transcript_turns)
    allow(assessment).to receive(:assessment_skills).and_return(assessment_skills)
    allow(portfolio).to receive(:update!)
    allow(portfolio_skills_relation).to receive(:destroy_all)
  end

  describe '#call — handling of null/missing levels from LLM' do
    context 'when the LLM returns level: null for an unevaluated skill' do
      let(:llm_response) do
        {
          'configured_skills' => [
            {
              'skill_id' => 'SK-ENG-001',
              'skill_label' => 'React / Frontend Development Core',
              'level' => 3,
              'confidence' => 'high',
              'evidence' => ['quote 1', 'quote 2'],
              'competency_summary' => 'Solid L3 performer.'
            },
            {
              'skill_id' => 'SK-ENG-002',
              'skill_label' => 'Node.js / Backend Development',
              'level' => nil,
              'confidence' => 'low',
              'evidence' => [],
              'competency_summary' => 'This skill was not explored during the interview.'
            }
          ],
          'discovered_skills' => []
        }
      end

      it 'saves the assessed skill with ai_level = 3' do
        allow(gemini_client).to receive(:generate_content).and_return(llm_response)

        expect(portfolio_skills_relation).to receive(:create!).with(
          hash_including(
            skill_id: 'SK-ENG-001',
            ai_level: 3,
            ai_confidence: 'high'
          )
        )

        expect(portfolio_skills_relation).to receive(:create!).with(
          hash_including(
            skill_id: 'SK-ENG-002',
            ai_level: nil,
            ai_confidence: 'low'
          )
        )

        subject.call
      end

      it 'does NOT clamp nil to 1 (the old broken behavior)' do
        allow(gemini_client).to receive(:generate_content).and_return(llm_response)

        # Capture all create! calls
        created_skills = []
        allow(portfolio_skills_relation).to receive(:create!) do |attrs|
          created_skills << attrs
        end

        subject.call

        unassessed = created_skills.find { |s| s[:skill_id] == 'SK-ENG-002' }
        expect(unassessed[:ai_level]).to be_nil,
          "Expected ai_level to be nil for unevaluated skill, but got #{unassessed[:ai_level]}. " \
          "The old .to_i.clamp(1,5) bug would produce 1 here."
      end
    end

    context 'when the LLM omits competency_summary for a skill' do
      let(:llm_response) do
        {
          'configured_skills' => [
            {
              'skill_id' => 'SK-ENG-001',
              'skill_label' => 'React',
              'level' => nil,
              'confidence' => nil,
              'evidence' => nil,
              'competency_summary' => nil
            }
          ],
          'discovered_skills' => []
        }
      end

      it 'provides sensible defaults for missing fields' do
        allow(gemini_client).to receive(:generate_content).and_return(llm_response)

        expect(portfolio_skills_relation).to receive(:create!).with(
          hash_including(
            ai_level: nil,
            ai_confidence: 'low',
            evidence: [],
            competency_summary: 'This skill was not explored during the interview.'
          )
        )

        subject.call
      end
    end
  end
end
