# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Portfolios::Generator do
  subject(:generate) { described_class.new(session: session, gemini_client: gemini).call }

  let(:assessment) { create(:assessment) }
  let(:session)    { create(:session, :ended, assessment: assessment) }
  let(:gemini)     { instance_double(Gemini::HttpClient, generate_content: model_response) }

  before do
    create(:assessment_skill, assessment: assessment, skill_id: 'sk-eng-001', skill_label: 'React')
    create(:transcript_turn, session: session, turn_number: 1, speaker: 'candidate')
  end

  def model_skill(confidence: 'high')
    {
      'skill_id'           => 'sk-eng-001',
      'skill_label'        => 'React',
      'level'              => 3,
      'confidence'         => confidence,
      'evidence'           => ['"I split the context into a read only provider and a write provider."'],
      'competency_summary' => 'Handles complex state architecture with clear tradeoff reasoning.'
    }
  end

  let(:model_response) { { 'configured_skills' => [model_skill], 'discovered_skills' => [] } }

  def saved_skill
    session.reload.portfolio.portfolio_skills.find_by(skill_id: 'sk-eng-001')
  end

  context 'when the analyzer judged the evidence sufficient' do
    before do
      create(:coverage_map, :covered, session: session,
                                      skill_id: 'sk-eng-001', skill_label: 'React', covered_by: 'analyzer')
    end

    it 'keeps the confidence the model assigned' do
      generate

      expect(saved_skill.ai_confidence).to eq('high')
    end

    it 'records the provenance on the portfolio itself' do
      generate

      expect(saved_skill.covered_by).to eq('analyzer')
    end
  end

  # A swept skill satisfies the prompt's own `high` rule without any model
  # having judged the evidence, so the service has to hold the line.
  context 'when the context window sweep made the promotion' do
    before do
      create(:coverage_map, :covered, session: session,
                                      skill_id: 'sk-eng-001', skill_label: 'React', covered_by: 'window_timeout')
    end

    it 'downgrades the confidence to low even though the model said high' do
      generate

      expect(saved_skill.ai_confidence).to eq('low')
    end

    it 'keeps the level and the evidence the model produced' do
      generate

      expect(saved_skill).to have_attributes(ai_level: 3, evidence: [a_string_including('read only provider')])
    end

    it 'records why the confidence was capped so the assessor can see it' do
      generate

      expect(saved_skill.covered_by).to eq('window_timeout')
    end
  end

  context 'when the promotion predates provenance tracking' do
    before do
      create(:coverage_map, :covered, session: session,
                                      skill_id: 'sk-eng-001', skill_label: 'React', covered_by: nil)
    end

    it 'treats unknown provenance as unverified' do
      generate

      expect(saved_skill.ai_confidence).to eq('low')
    end
  end

  context 'when the skill was never promoted to covered' do
    before do
      create(:coverage_map, :partial, session: session, skill_id: 'sk-eng-001', skill_label: 'React')
    end

    it 'leaves the confidence the model assigned alone' do
      generate

      expect(saved_skill.ai_confidence).to eq('medium')
    end

    let(:model_response) { { 'configured_skills' => [model_skill(confidence: 'medium')], 'discovered_skills' => [] } }
  end

  context 'when the model returns a confidence outside the allowed set' do
    before do
      create(:coverage_map, :covered, session: session,
                                      skill_id: 'sk-eng-001', skill_label: 'React', covered_by: 'analyzer')
    end

    let(:model_response) { { 'configured_skills' => [model_skill(confidence: 'very high')], 'discovered_skills' => [] } }

    it 'falls back to low instead of failing the whole portfolio' do
      generate

      expect(saved_skill.ai_confidence).to eq('low')
    end

    it 'still completes the generation' do
      generate

      expect(session.reload.portfolio.generation_status).to eq('complete')
    end
  end

  context 'with a discovered skill promoted by the sweep' do
    before do
      create(:coverage_map, :covered, session: session, is_discovered: true,
                                      skill_id: nil, skill_label: 'Micro-frontend Architecture',
                                      covered_by: 'window_timeout')
    end

    let(:model_response) do
      {
        'configured_skills' => [],
        'discovered_skills' => [
          { 'skill_label' => 'Micro-frontend Architecture', 'level' => 2, 'confidence' => 'high',
            'evidence' => ['"We used Module Federation."'],
            'competency_summary' => 'Hands on experience, briefly explored.' }
        ]
      }
    end

    it 'downgrades it the same way as a configured skill' do
      generate

      skill = session.reload.portfolio.portfolio_skills.find_by(skill_label: 'Micro-frontend Architecture')
      expect(skill.ai_confidence).to eq('low')
    end
  end
end
