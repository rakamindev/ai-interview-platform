# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Coverage::Analyzer do
  let(:session) { create(:session) }
  let!(:map) { create(:coverage_map, session: session, skill_label: 'Ruby', state: 'not_yet') }
  let(:mock_gemini) { instance_double(Gemini::HttpClient) }

  subject(:analyzer) { described_class.new(session: session, gemini_client: mock_gemini) }

  before do
    create(:transcript_turn, session: session, speaker: 'candidate', text: 'I use Ruby on Rails daily.')
  end

  it 'handles invalid new_state by filtering it out' do
    allow(mock_gemini).to receive(:generate_content).and_return({
      'skill_updates' => [
        { 'id' => 'ruby', 'new_state' => 'INVALID_STATE', 'new_probe_count' => 2 }
      ]
    })

    result = analyzer.call
    expect(result[:skill_updates]).to be_empty
  end

  it 'handles parser errors by returning empty updates' do
    allow(mock_gemini).to receive(:generate_content).and_raise(JSON::ParserError.new('invalid json'))

    result = analyzer.call
    expect(result[:skill_updates]).to be_empty
    expect(result[:discovered_skills]).to be_empty
  end
end
