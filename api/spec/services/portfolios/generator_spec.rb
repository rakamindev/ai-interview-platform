# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Portfolios::Generator do
  subject(:generate) { described_class.new(session: session, gemini_client: client).call }

  let(:tenant_id) { create_organization(scheme: 'gen-corp') }
  let(:assessment) { create(:assessment) }
  let(:session)    { create(:session, assessment: assessment) }
  let(:client)     { instance_double(Gemini::HttpClient, generate_content: response) }
  let(:response)   { { 'configured_skills' => [], 'discovered_skills' => [] } }

  before do
    Current.tenant_id = tenant_id
    create(:transcript_turn, session: session)
    create(:coverage_map, session: session)
  end

  def skill_payload(overrides = {})
    {
      'skill_id'           => 'SK-ENG-001',
      'skill_label'        => 'React',
      'level'              => 3,
      'confidence'         => 'high',
      'evidence'           => ['a quote'],
      'competency_summary' => 'a summary'
    }.merge(overrides)
  end

  describe 'level coercion' do
    # The defect this replaces: `level.to_i.clamp(1, 5)` mapped nil, "", 0 and
    # "three" all onto 1 — the anchor reading "cannot apply independently".
    # A skill nobody could assess became a documented weakness.
    {
      'a missing level'     => nil,
      'an empty string'     => '',
      'a non-numeric level' => 'three',
      'zero'                => 0,
      'an out-of-range 9'   => 9
    }.each do |description, value|
      it "records no level for #{description} rather than defaulting to L1" do
        allow(client).to receive(:generate_content).and_return(
          { 'configured_skills' => [skill_payload('level' => value)] }
        )

        generate

        skill = session.portfolio.portfolio_skills.sole
        expect(skill.ai_level).to be_nil
        expect(skill).not_to be_assessed
      end
    end

    it 'accepts an integer level' do
      allow(client).to receive(:generate_content).and_return(
        { 'configured_skills' => [skill_payload('level' => 4)] }
      )
      generate
      expect(session.portfolio.portfolio_skills.sole.ai_level).to eq(4)
    end

    it 'accepts an "L4"-style level' do
      allow(client).to receive(:generate_content).and_return(
        { 'configured_skills' => [skill_payload('level' => 'L4')] }
      )
      generate
      expect(session.portfolio.portfolio_skills.sole.ai_level).to eq(4)
    end

    it 'forces confidence to low when no level could be determined' do
      allow(client).to receive(:generate_content).and_return(
        { 'configured_skills' => [skill_payload('level' => nil, 'confidence' => 'high')] }
      )
      generate
      expect(session.portfolio.portfolio_skills.sole.ai_confidence).to eq('low')
    end

    it 'degrades an unrecognised confidence to low instead of raising' do
      allow(client).to receive(:generate_content).and_return(
        { 'configured_skills' => [skill_payload('confidence' => 'very high')] }
      )
      generate
      expect(session.portfolio.portfolio_skills.sole.ai_confidence).to eq('low')
    end
  end

  describe 'partial writes' do
    let!(:portfolio) { create(:portfolio, session: session) }
    let!(:existing)  { create(:portfolio_skill, portfolio: portfolio, skill_label: 'Kept', ai_level: 4) }

    # destroy_all previously ran before any validation, outside a transaction.
    # A malformed response emptied the portfolio and left it 'failed' — and
    # because the worker retries three times, it did so four times over.
    it 'leaves existing skills intact when the response is unusable' do
      allow(client).to receive(:generate_content).and_return({ 'something_else' => [] })

      expect { generate }.to raise_error(described_class::UnusableResponse)

      expect(portfolio.reload.portfolio_skills.pluck(:skill_label)).to eq(['Kept'])
    end

    it 'leaves existing skills intact when the response is not valid JSON' do
      allow(client).to receive(:generate_content).and_return('{ not json')

      expect { generate }.to raise_error(JSON::ParserError)

      expect(portfolio.reload.portfolio_skills.pluck(:skill_label)).to eq(['Kept'])
    end

    it 'rolls back every skill when one row fails mid-batch' do
      # A real failure mode rather than a stub: skill_label is varchar(255),
      # and nothing in normalisation truncates it. The first row inserts
      # cleanly and the second blows up, which is exactly the interleaving
      # that used to leave a half-written portfolio behind.
      allow(client).to receive(:generate_content).and_return(
        'configured_skills' => [
          skill_payload('skill_label' => 'First'),
          skill_payload('skill_label' => 'S' * 300)
        ]
      )

      expect { generate }.to raise_error(ActiveRecord::StatementInvalid)

      expect(portfolio.reload.portfolio_skills.pluck(:skill_label)).to eq(['Kept'])
    end
  end

  describe 'assessor overrides' do
    let!(:portfolio) { create(:portfolio, session: session) }
    let!(:skill) do
      create(:portfolio_skill, portfolio: portfolio, skill_id: 'SK-ENG-001', skill_label: 'React', ai_level: 3)
    end
    let!(:override) do
      create(:assessor_override, portfolio_skill: skill, ai_level: 3, override_level: 5,
                                 assessor_notes: 'Saw a work sample.', overridden_by: 42)
    end

    # portfolio_skills has_one :assessor_override, dependent: :destroy, so
    # destroy_all silently discarded the only human judgement in the system.
    it 'survives a regeneration' do
      allow(client).to receive(:generate_content).and_return(
        { 'configured_skills' => [skill_payload('level' => 2)] }
      )

      generate

      restored = portfolio.reload.portfolio_skills.sole.assessor_override
      expect(restored).to be_present
      expect(restored.override_level).to eq(5)
      expect(restored.assessor_notes).to eq('Saw a work sample.')
      expect(restored.overridden_by).to eq(42)
    end

    it 'keeps the AI level the assessor was disagreeing with, not the new one' do
      allow(client).to receive(:generate_content).and_return(
        { 'configured_skills' => [skill_payload('level' => 2)] }
      )

      generate

      restored = portfolio.reload.portfolio_skills.sole
      expect(restored.ai_level).to eq(2)              # the new model rating
      expect(restored.assessor_override.ai_level).to eq(3) # what was overruled
    end

    it 'matches on label when the taxonomy id is absent' do
      skill.update!(skill_id: nil)
      allow(client).to receive(:generate_content).and_return(
        { 'configured_skills' => [skill_payload('skill_id' => nil, 'skill_label' => '  react  ')] }
      )

      generate

      expect(portfolio.reload.portfolio_skills.sole.assessor_override).to be_present
    end
  end

  describe 'failure reporting (UU PDP)' do
    let!(:portfolio) { create(:portfolio, session: session) }

    # generation_error is persisted and served back to assessors, and the same
    # string was written to the application log. A JSON::ParserError message
    # embeds the fragment it failed on — which is the model's rendering of
    # what the candidate said.
    it 'does not persist candidate transcript content in generation_error' do
      leaked = 'I moved us off Redux because it was mostly cached responses'
      allow(client).to receive(:generate_content).and_return(%({"configured_skills": [#{leaked}]}))

      expect { generate }.to raise_error(JSON::ParserError)

      expect(portfolio.reload.generation_error).to be_present
      expect(portfolio.generation_error).not_to include('Redux')
      expect(portfolio.generation_error).not_to include(leaked)
    end

    it 'does not write candidate transcript content to the log' do
      leaked = 'I profile before reaching for memoisation'
      allow(client).to receive(:generate_content).and_return(%({"configured_skills": [#{leaked}]}))

      logged = []
      allow(Rails.logger).to receive(:error) { |msg| logged << msg.to_s }

      expect { generate }.to raise_error(JSON::ParserError)

      expect(logged.join("\n")).not_to include('memoisation')
    end

    it 'still records something actionable' do
      allow(client).to receive(:generate_content).and_return('{ not json')
      expect { generate }.to raise_error(JSON::ParserError)
      expect(portfolio.reload.generation_error).to eq('The model returned a response that was not valid JSON.')
    end
  end

  describe 'response shapes' do
    it 'treats a response with only discovered_skills as valid' do
      allow(client).to receive(:generate_content).and_return(
        { 'discovered_skills' => [skill_payload('skill_id' => nil, 'skill_label' => 'Tooling')] }
      )
      generate
      expect(session.portfolio.portfolio_skills.sole).to have_attributes(
        skill_label: 'Tooling', is_discovered: true, skill_id: nil
      )
    end

    it 'skips rows with no skill_label rather than failing the batch' do
      allow(client).to receive(:generate_content).and_return(
        'configured_skills' => [skill_payload, skill_payload('skill_label' => nil)]
      )
      generate
      expect(session.portfolio.portfolio_skills.count).to eq(1)
    end

    it 'caps evidence at three quotes' do
      allow(client).to receive(:generate_content).and_return(
        { 'configured_skills' => [skill_payload('evidence' => %w[a b c d e])] }
      )
      generate
      expect(session.portfolio.portfolio_skills.sole.evidence.length).to eq(3)
    end

    it 'substitutes a neutral summary when none is returned' do
      allow(client).to receive(:generate_content).and_return(
        { 'configured_skills' => [skill_payload('competency_summary' => nil)] }
      )
      generate
      expect(session.portfolio.portfolio_skills.sole.competency_summary)
        .to eq(described_class::NEUTRAL_SUMMARY)
    end
  end
end
