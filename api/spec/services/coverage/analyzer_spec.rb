# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Coverage::Analyzer do
  let(:session) { create(:session) }
  let(:gemini) { instance_double(Gemini::HttpClient) }

  it 'returns empty updates without calling Gemini when no transcript exists' do
    expect(gemini).not_to receive(:generate_content)

    result = described_class.new(session: session, gemini_client: gemini).call

    expect(result).to eq(skill_updates: [], discovered_skills: [])
  end

  it 'caps probe increments and applies the state transition gate' do
    map = create(:coverage_map, session: session, skill_id: 'ruby', skill_label: 'Ruby',
                               state: 'initiated', probe_count: 1)
    create(:transcript_turn, session: session)

    allow(gemini).to receive(:generate_content).and_return(
      'skill_updates' => [
        { 'id' => 'ruby', 'new_state' => 'covered', 'new_probe_count' => 9, 'reason' => 'Two examples discussed' },
        { 'id' => 'unknown', 'new_state' => 'covered', 'new_probe_count' => 9, 'reason' => 'Unknown skill' }
      ],
      'discovered_skills' => [
        { 'label' => 'System Design', 'first_mention' => 'Discussed service boundaries' }
      ]
    )

    result = described_class.new(session: session, gemini_client: gemini).call

    expect(result[:skill_updates].size).to eq(1)
    expect(result[:skill_updates].first).to include(
      coverage_map_id: map.id,
      new_state: 'partial',
      new_probe_count: 2
    )
    expect(result[:discovered_skills].first[:label]).to eq('System Design')
  end

  it 'does not advance an already covered skill' do
    map = create(:coverage_map, session: session, skill_id: 'ruby', skill_label: 'Ruby',
                               state: 'covered', probe_count: 3)
    create(:transcript_turn, session: session)
    allow(gemini).to receive(:generate_content).and_return(
      'skill_updates' => [
        { 'id' => 'ruby', 'new_state' => 'covered', 'new_probe_count' => 5, 'reason' => 'Repeated evidence' }
      ],
      'discovered_skills' => []
    )

    result = described_class.new(session: session, gemini_client: gemini).call

    expect(result[:skill_updates]).to be_empty
    expect(map.reload.state).to eq('covered')
  end

  it 'returns empty updates for malformed JSON text' do
    create(:transcript_turn, session: session)
    allow(gemini).to receive(:generate_content).and_return('{invalid json')

    result = described_class.new(session: session, gemini_client: gemini).call

    expect(result).to eq(skill_updates: [], discovered_skills: [])
  end
end
