# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Gemini::MockClient do
  subject(:client) { described_class.new(role: :portfolio) }

  describe '#generate_content' do
    it 'returns one rating per skill in the coverage map embedded in the prompt' do
      prompt = <<~PROMPT
        ROLE BEING ASSESSED: QA Engineer

        FINAL COVERAGE MAP:
        {"skills":[{"id":"sk-eng-001","label":"React / Frontend Development","state":"covered","probe_count":3,"is_discovered":false}],"discovered":[]}

        FULL INTERVIEW TRANSCRIPT:
        [CANDIDATE]: I built a dashboard.
      PROMPT

      payload = client.generate_content(prompt, temperature: 0.2)

      expect(payload['configured_skills'].length).to eq(1)
      expect(payload['configured_skills'].first).to include(
        'skill_label'        => 'React / Frontend Development',
        'level'              => 4,
        'confidence'         => 'high',
        'competency_summary' => start_with('(mock)')
      )
      expect(payload['discovered_skills']).to eq([])
    end

    it 'never invents interview signal for the analysis role' do
      prompt = "--- BEGIN UNTRUSTED TRANSCRIPT ---\n[CANDIDATE]: hello"

      expect(client.generate_content(prompt)).to eq('skill_updates' => [], 'discovered_skills' => [])
    end

    it 'returns the narrative fixture for fit/gap prompts' do
      payload = client.generate_content('{"culture_narrative":"pending"}')

      expect(payload.keys).to contain_exactly('culture_narrative', 'overall_narrative')
    end

    it 'answers an unrecognised prompt with a valid payload instead of raising' do
      payload = client.generate_content('something unexpected')

      expect(payload).to include('ok' => true, 'mock' => true)
    end
  end
end
