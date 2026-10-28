# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Portfolios::Generator do
  let(:org) { create_organization('acme') }
  let(:session) do
    as_tenant(org) do
      assessment = create(:assessment)
      create(:assessment_skill, assessment:, skill_id: 'sk-eng-001', skill_label: 'React')
      create(:assessment_skill, assessment:, skill_label: 'System Design')
      create(:session, assessment:)
    end
  end

  before do
    create(:coverage_map, session:, skill_id: 'sk-eng-001', skill_label: 'React', state: 'covered', probe_count: 4)
    create(:coverage_map, session:, skill_label: 'System Design', state: 'not_yet', probe_count: 0)
    create(:transcript_turn, session:, turn_number: 1, speaker: 'ai', text: 'Tell me about a hard React problem.')
    create(:transcript_turn, session:, turn_number: 2, text: 'We moved hot dashboard data into a ref so it stopped re-rendering.')
  end

  let(:good_response) do
    {
      'configured_skills' => [
        { 'skill_id' => 'sk-eng-001', 'skill_label' => 'React', 'level' => 3, 'confidence' => 'high',
          'evidence' => ['We moved hot dashboard data into a ref'], 'competency_summary' => 'Solid.' },
        { 'skill_label' => 'System Design', 'level' => 1, 'confidence' => 'low', 'evidence' => [], 'competency_summary' => '—' }
      ]
    }
  end

  def generate(response = good_response, raises: nil, **opts)
    described_class.new(session: session.reload, gemini_client: ScriptedModel.new(response, raises:)).call(**opts)
  end

  it 'persists a complete portfolio where the never-reached skill has no level' do
    portfolio = generate

    expect(portfolio.reload).to have_attributes(generation_status: 'complete', generation_error: nil, generation_attempts: 1)
    expect(portfolio.portfolio_skills.order(:id).pluck(:skill_label, :assessment_status, :ai_level, :ai_confidence)).to eq([
      ['React', 'assessed', 3, 'high'],
      ['System Design', 'not_assessed', nil, nil]
    ])
    expect(portfolio.portfolio_skills.find_by(skill_label: 'React').evidence_refs)
      .to eq([{ 'quote' => 'We moved hot dashboard data into a ref', 'turn_number' => 2 }])
  end

  it 'marks the transcript as untrusted input in the prompt' do
    model = ScriptedModel.new(good_response)
    described_class.new(session:, gemini_client: model).call

    expect(model.prompts.first).to include('--- BEGIN UNTRUSTED TRANSCRIPT ---', '[CANDIDATE]: We moved hot dashboard data')
  end

  describe 'duplicate jobs' do
    it 'does not call the model again once the portfolio is complete' do
      generate
      model = ScriptedModel.new(good_response)

      expect(described_class.new(session: session.reload, gemini_client: model).call).to be_nil
      expect(model.prompts).to be_empty
    end

    it 'keeps assessor overrides when a duplicate job runs' do
      skill = generate.portfolio_skills.find_by(skill_label: 'React')
      skill.create_assessor_override!(ai_level: 3, override_level: 4, overridden_by: 7, assessor_notes: 'Follow-up call')

      generate

      expect(AssessorOverride.find_by(portfolio_skill_id: skill.id)).to have_attributes(override_level: 4)
    end

    it 'does not start while another run holds a fresh claim' do
      create(:portfolio, session:, generation_status: 'generating', generation_started_at: 1.minute.ago)
      model = ScriptedModel.new(good_response)

      expect(described_class.new(session: session.reload, gemini_client: model).call).to be_nil
      expect(model.prompts).to be_empty
    end

    it 'takes over a claim abandoned by a crashed worker' do
      create(:portfolio, session:, generation_status: 'generating', generation_started_at: 30.minutes.ago)

      expect(generate.reload.generation_status).to eq('complete')
    end

    it 'carries overrides onto the regenerated skill when forced' do
      skill = generate.portfolio_skills.find_by(skill_label: 'React')
      skill.create_assessor_override!(ai_level: 3, override_level: 2, overridden_by: 7, assessor_notes: 'Weak on testing')

      portfolio = generate(force: true)
      new_skill = portfolio.portfolio_skills.find_by(skill_label: 'React')

      expect(new_skill.id).not_to eq(skill.id)
      expect(new_skill.assessor_override).to have_attributes(override_level: 2, ai_level: 3, assessor_notes: 'Weak on testing')
    end
  end

  describe 'model failures' do
    it 'marks the portfolio failed with a safe message on timeout and re-raises for Sidekiq retry' do
      error = Gemini::HttpClient::TimeoutError.new('timeout after 180s: <full request body>')

      expect { generate(raises: error) }.to raise_error(Gemini::HttpClient::TimeoutError)
      expect(session.reload.portfolio).to have_attributes(
        generation_status: 'failed', generation_error: 'The AI model took too long to respond.'
      )
    end

    it 'never stores raw exception text' do
      expect { generate(raises: RuntimeError.new('PG::Error candidate Budi Santoso')) }.to raise_error(RuntimeError)
      expect(session.reload.portfolio.generation_error).to eq('Portfolio generation failed unexpectedly.')
    end

    it 'fails instead of completing an empty portfolio when the model returns {}' do
      expect { generate({}) }.to raise_error(Portfolios::ResponseNormalizer::InvalidResponse)
      expect(session.reload.portfolio).to have_attributes(generation_status: 'failed')
      expect(session.portfolio.portfolio_skills).to be_empty
    end

    it 'fails on non-JSON text from the model' do
      expect { generate('Sure! Here is the portfolio you asked for…') }
        .to raise_error(Portfolios::ResponseNormalizer::InvalidResponse, /not valid JSON/)
    end

    it 'leaves the previous skills untouched when a write fails part-way (no partial writes)' do
      portfolio = generate
      before = portfolio.portfolio_skills.order(:id).pluck(:id, :ai_level)

      allow_any_instance_of(PortfolioSkill).to receive(:save!).and_wrap_original do |original, *args, **kwargs|
        raise ActiveRecord::StatementInvalid, 'disk full' if original.receiver.skill_label == 'System Design'

        original.call(*args, **kwargs)
      end

      expect { generate(force: true) }.to raise_error(ActiveRecord::StatementInvalid)
      expect(portfolio.reload.portfolio_skills.order(:id).pluck(:id, :ai_level)).to eq(before)
      expect(portfolio.generation_status).to eq('failed')
    end
  end
end
