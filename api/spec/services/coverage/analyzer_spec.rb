# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Coverage::Analyzer do
  let(:assessment) { create(:assessment, :with_skills) }
  let(:session)    { create(:session, assessment:, status: 'active', started_at: 5.minutes.ago) }
  let!(:react)     { create(:coverage_map, session:, skill_id: 'SK-ENG-001', skill_label: 'React', state: 'initiated', probe_count: 1) }
  let!(:comms)     { create(:coverage_map, session:, skill_id: 'SK-SOFT-001', skill_label: 'Communication') }

  def analyze(response)
    described_class.new(session:, gemini_client: FakeGemini.new(response)).call
  end

  context 'when there is no transcript yet' do
    it 'does not call the model' do
      client = FakeGemini.new({})
      result = described_class.new(session:, gemini_client: client).call

      expect(result).to eq(skill_updates: [], discovered_skills: [])
      expect(client.prompts).to be_empty
    end
  end

  context 'with transcript turns' do
    before do
      create(:transcript_turn, session:, turn_number: 1, speaker: 'ai', text: 'How did you profile it?')
      create(:transcript_turn, session:, turn_number: 2, speaker: 'candidate', text: 'React DevTools, then useRef.')
    end

    it 'caps the probe increment at +1 per run even if the model inflates it' do
      result = analyze('skill_updates' => [{ 'id' => 'SK-ENG-001', 'new_state' => 'partial', 'new_probe_count' => 7 }])

      update = result[:skill_updates].sole
      expect(update[:new_probe_count]).to eq(2)
      expect(update[:new_state]).to eq('partial')
    end

    it 'never lets probe_count go down' do
      result = analyze('skill_updates' => [{ 'id' => 'SK-ENG-001', 'new_state' => 'initiated', 'new_probe_count' => 0 }])

      expect(result[:skill_updates].sole[:new_probe_count]).to eq(1)
    end

    it 'applies the state engine instead of trusting the proposed state' do
      result = analyze('skill_updates' => [{ 'id' => 'SK-SOFT-001', 'new_state' => 'covered', 'new_probe_count' => 1 }])

      expect(result[:skill_updates].sole[:new_state]).to eq('initiated')
    end

    it 'freezes skills that are already covered' do
      react.update!(state: 'covered', probe_count: 4)

      result = analyze('skill_updates' => [{ 'id' => 'SK-ENG-001', 'new_state' => 'covered', 'new_probe_count' => 5 }])

      expect(result[:skill_updates]).to be_empty
    end

    it 'ignores updates for skills that are not in the map' do
      result = analyze('skill_updates' => [{ 'id' => 'SK-UNKNOWN', 'new_state' => 'partial', 'new_probe_count' => 2 }])

      expect(result[:skill_updates]).to be_empty
    end

    it 'matches custom skills by their slugified label' do
      custom = create(:coverage_map, session:, skill_id: nil, skill_label: 'Stakeholder Management')

      result = analyze('skill_updates' => [{ 'id' => 'stakeholder-management', 'new_state' => 'initiated', 'new_probe_count' => 1 }])

      expect(result[:skill_updates].sole[:coverage_map_id]).to eq(custom.id)
    end

    it 'returns discovered skills from the model' do
      result = analyze('discovered_skills' => [{ 'label' => 'Micro-frontends', 'first_mention' => 'Split the app into four.' }])

      expect(result[:discovered_skills]).to eq([{ label: 'Micro-frontends', first_mention: 'Split the app into four.' }])
    end

    it 'returns no updates when the model answers with prose instead of JSON' do
      expect(analyze('Sure! Here is my analysis...')).to eq(skill_updates: [], discovered_skills: [])
    end

    it 'marks the transcript as untrusted in the prompt' do
      client = FakeGemini.new({})
      described_class.new(session:, gemini_client: client).call

      expect(client.prompts.sole[:prompt]).to include('--- BEGIN UNTRUSTED TRANSCRIPT ---')
    end
  end
end
