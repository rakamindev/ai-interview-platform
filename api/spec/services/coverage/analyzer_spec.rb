# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Coverage::Analyzer do
  let(:organization) { create(:organization) }
  let(:assessment) { create(:assessment, organization:) }
  let(:session) { create(:session, organization:, assessment:, status: 'active') }
  let(:gemini_client) { instance_double(Gemini::HttpClient) }
  let(:analyzer) { described_class.new(session:, gemini_client:) }

  def add_skill(skill_id:, skill_label:)
    assessment.assessment_skills.create!(
      skill_id:,
      skill_label:,
      is_custom: false,
      scope_include: "Synthetic scope for #{skill_label}.",
      l1_anchor: 'Synthetic L1 anchor.',
      l2_anchor: 'Synthetic L2 anchor.',
      l3_anchor: 'Synthetic L3 anchor.',
      l4_anchor: 'Synthetic L4 anchor.',
      l5_anchor: 'Synthetic L5 anchor.',
      display_order: 0
    )
  end

  def add_map(skill_id:, skill_label:, state: 'not_yet', probe_count: 0, discovered: false)
    session.coverage_maps.create!(
      skill_id:,
      skill_label:,
      is_discovered: discovered,
      state:,
      probe_count:
    )
  end

  def add_turns(texts)
    texts.each_with_index do |text, index|
      session.transcript_turns.create!(
        turn_number: index + 1,
        speaker:     index.even? ? 'ai' : 'candidate',
        text:
      )
    end
  end

  def capture_prompts(response)
    prompts = []
    allow(gemini_client).to receive(:generate_content) do |prompt, **_options|
      prompts << prompt
      response
    end
    prompts
  end

  describe 'happy path' do
    it 'turns a provider payload into skill updates without writing them itself' do
      add_skill(skill_id: 'ruby', skill_label: 'Ruby')
      map = add_map(skill_id: 'ruby', skill_label: 'Ruby')
      add_turns(['Tell me about your Ruby work.', 'I shipped a billing service.'])
      capture_prompts(
        {
          'skill_updates'     => [
            { 'id' => 'ruby', 'new_state' => 'initiated', 'new_probe_count' => 1, 'reason' => 'opening question asked' }
          ],
          'discovered_skills' => []
        }
      )

      result = analyzer.call

      expect(result[:skill_updates]).to eq(
        [
          {
            coverage_map_id: map.id,
            skill_id:        'ruby',
            skill_label:     'Ruby',
            new_state:       'initiated',
            new_probe_count: 1,
            last_signal:     'opening question asked'
          }
        ]
      )
      expect(result[:discovered_skills]).to eq([])
      expect(map.reload.state).to eq('not_yet')
      expect(map.probe_count).to eq(0)
    end

    it 'sends the transcript, the coverage map, and the skill definitions to the provider' do
      add_skill(skill_id: 'ruby', skill_label: 'Ruby')
      add_map(skill_id: 'ruby', skill_label: 'Ruby')
      add_turns(['Synthetic opening question.', 'Synthetic candidate answer.'])
      prompts = capture_prompts({ 'skill_updates' => [], 'discovered_skills' => [] })

      analyzer.call

      expect(prompts.length).to eq(1)
      expect(prompts.first).to include('Synthetic opening question.')
      expect(prompts.first).to include('Synthetic candidate answer.')
      expect(prompts.first).to include('- ruby: Ruby — Synthetic scope for Ruby.')
      expect(prompts.first).to include('"id":"ruby"')
    end
  end

  describe 'alternate path' do
    it 'reports a discovered skill the candidate raised outside the agenda' do
      add_skill(skill_id: 'ruby', skill_label: 'Ruby')
      add_turns(['Tell me about your work.', 'I also ran the Kubernetes migration.'])
      capture_prompts(
        {
          'skill_updates'     => [],
          'discovered_skills' => [
            { 'label' => 'Kubernetes Operations', 'first_mention' => 'candidate described a cluster migration' }
          ]
        }
      )

      result = analyzer.call

      expect(result[:discovered_skills]).to eq(
        [
          {
            label:         'Kubernetes Operations',
            first_mention: 'candidate described a cluster migration'
          }
        ]
      )
      expect(session.coverage_maps.discovered.count).to eq(0)
    end

    it 'matches an update by the generated label slug when no skill id exists' do
      custom = assessment.assessment_skills.create!(
        skill_id:       nil,
        skill_label:    'Stakeholder Calm',
        is_custom:      true,
        scope_include:  'Keeps stakeholders informed under pressure.',
        l1_anchor:      'Synthetic L1 anchor.',
        l2_anchor:      'Synthetic L2 anchor.',
        l3_anchor:      'Synthetic L3 anchor.',
        l4_anchor:      'Synthetic L4 anchor.',
        l5_anchor:      'Synthetic L5 anchor.',
        display_order:  0
      )
      map = add_map(skill_id: nil, skill_label: custom.skill_label)
      add_turns(['How do you handle a slipping deadline?', 'I sent a short written update.'])
      capture_prompts(
        { 'skill_updates' => [{ 'id' => 'stakeholder-calm', 'new_state' => 'initiated', 'new_probe_count' => 1 }] }
      )

      result = analyzer.call

      expect(result[:skill_updates].first).to include(coverage_map_id: map.id, new_state: 'initiated')
    end
  end

  describe 'identity matching' do
    it 'matches a provider label to a configured skill when the provider uses a descriptive alias' do
      add_skill(skill_id: 'synthetic-react', skill_label: 'Synthetic React Skill')
      map = add_map(skill_id: 'synthetic-react', skill_label: 'Synthetic React Skill')
      add_turns(['Tell me about frontend state.', 'I used React and Zustand.'])
      capture_prompts(
        { 'skill_updates' => [{ 'id' => 'react', 'new_state' => 'initiated', 'new_probe_count' => 1 }] }
      )

      result = analyzer.call

      expect(result[:skill_updates].first).to include(
        coverage_map_id: map.id,
        skill_id: 'synthetic-react',
        new_state: 'initiated'
      )
    end
  end

  describe 'sad path' do
    it 'propagates a provider failure without touching the coverage map' do
      add_skill(skill_id: 'ruby', skill_label: 'Ruby')
      map = add_map(skill_id: 'ruby', skill_label: 'Ruby')
      add_turns(['Synthetic opening question.', 'Synthetic candidate answer.'])
      allow(gemini_client).to receive(:generate_content)
        .and_raise(Gemini::HttpClient::ApiError.new('API returned 500', status: 500))

      expect { analyzer.call }.to raise_error(Gemini::HttpClient::ApiError, 'API returned 500')

      map.reload
      expect(map.state).to eq('not_yet')
      expect(map.probe_count).to eq(0)
      expect(map.last_signal).to be_nil
    end
  end

  describe 'bad path' do
    it 'returns an empty result for a response that is not valid JSON' do
      add_skill(skill_id: 'ruby', skill_label: 'Ruby')
      add_map(skill_id: 'ruby', skill_label: 'Ruby')
      add_turns(['Synthetic opening question.', 'Synthetic candidate answer.'])
      allow(gemini_client).to receive(:generate_content).and_return('{not json at all')

      expect(analyzer.call).to eq(skill_updates: [], discovered_skills: [])
    end

    it 'skips an update entry that carries no identity' do
      add_skill(skill_id: 'ruby', skill_label: 'Ruby')
      map = add_map(skill_id: 'ruby', skill_label: 'Ruby')
      add_turns(['Synthetic opening question.', 'Synthetic candidate answer.'])
      capture_prompts(
        {
          'skill_updates' => [
            'not-an-update-object',
            { 'id' => 'ruby', 'new_state' => 'initiated', 'new_probe_count' => 1 }
          ]
        }
      )

      result = analyzer.call

      expect(result[:skill_updates].length).to eq(1)
      expect(result[:skill_updates].first).to include(coverage_map_id: map.id, new_state: 'initiated')
    end

    it 'keeps the state when the provider proposes a state the engine does not know' do
      add_skill(skill_id: 'ruby', skill_label: 'Ruby')
      map = add_map(skill_id: 'ruby', skill_label: 'Ruby')
      add_turns(['Synthetic opening question.', 'Synthetic candidate answer.'])
      capture_prompts(
        { 'skill_updates' => [{ 'id' => 'ruby', 'new_state' => 'excellent', 'new_probe_count' => 2 }] }
      )

      result = analyzer.call

      expect(result[:skill_updates].first).to include(new_state: 'not_yet', new_probe_count: 1)
      expect(map.reload.state).to eq('not_yet')
    end
  end

  describe 'edge path' do
    it 'builds the prompt from exactly the last six turns' do
      add_skill(skill_id: 'ruby', skill_label: 'Ruby')
      add_map(skill_id: 'ruby', skill_label: 'Ruby')
      add_turns(
        [
          'turn one text',
          'turn two text',
          'turn three text',
          'turn four text',
          'turn five text',
          'turn six text',
          'turn seven text',
          'turn eight text'
        ]
      )
      prompts = capture_prompts({ 'skill_updates' => [], 'discovered_skills' => [] })

      analyzer.call

      expect(prompts.first).not_to include('turn one text')
      expect(prompts.first).not_to include('turn two text')
      expect(prompts.first).to include('turn three text')
      expect(prompts.first).to include('turn eight text')
      expect(prompts.first).to include('LAST 6 TRANSCRIPT TURNS')
    end

    it 'caps a runaway probe count at one increment per run' do
      add_skill(skill_id: 'ruby', skill_label: 'Ruby')
      map = add_map(skill_id: 'ruby', skill_label: 'Ruby', state: 'initiated', probe_count: 2)
      add_turns(['Synthetic opening question.', 'Synthetic candidate answer.'])
      capture_prompts(
        { 'skill_updates' => [{ 'id' => 'ruby', 'new_state' => 'partial', 'new_probe_count' => 5 }] }
      )

      result = analyzer.call

      expect(result[:skill_updates].first).to include(new_probe_count: 3, new_state: 'partial')
      expect(map.reload.probe_count).to eq(2)
    end

    it 'freezes a covered skill so a sliding window cannot re-probe it' do
      add_skill(skill_id: 'ruby', skill_label: 'Ruby')
      add_map(skill_id: 'ruby', skill_label: 'Ruby', state: 'covered', probe_count: 3)
      add_turns(['Synthetic opening question.', 'Synthetic candidate answer.'])
      capture_prompts(
        { 'skill_updates' => [{ 'id' => 'ruby', 'new_state' => 'covered', 'new_probe_count' => 4 }] }
      )

      result = analyzer.call

      expect(result[:skill_updates]).to eq([])
    end

    it 'updates only the skills the provider mentioned' do
      add_skill(skill_id: 'ruby', skill_label: 'Ruby')
      add_skill(skill_id: 'sql', skill_label: 'SQL')
      mentioned  = add_map(skill_id: 'ruby', skill_label: 'Ruby')
      untouched  = add_map(skill_id: 'sql', skill_label: 'SQL')
      add_turns(['Synthetic opening question.', 'Synthetic candidate answer.'])
      capture_prompts(
        { 'skill_updates' => [{ 'id' => 'ruby', 'new_state' => 'initiated', 'new_probe_count' => 1 }] }
      )

      result = analyzer.call

      expect(result[:skill_updates].map { |update| update[:coverage_map_id] }).to eq([mentioned.id])
      expect(untouched.reload.probe_count).to eq(0)
    end
  end

  describe 'empty path' do
    it 'returns an empty result without calling the provider when nothing was said' do
      add_skill(skill_id: 'ruby', skill_label: 'Ruby')
      map = add_map(skill_id: 'ruby', skill_label: 'Ruby')
      expect(gemini_client).not_to receive(:generate_content)

      result = analyzer.call

      expect(result).to eq(skill_updates: [], discovered_skills: [])
      expect(map.reload.state).to eq('not_yet')
    end

    it 'returns an empty result when the provider answers without any keys' do
      add_skill(skill_id: 'ruby', skill_label: 'Ruby')
      add_map(skill_id: 'ruby', skill_label: 'Ruby')
      add_turns(['Synthetic opening question.', 'Synthetic candidate answer.'])
      capture_prompts({})

      expect(analyzer.call).to eq(skill_updates: [], discovered_skills: [])
    end
  end
end
