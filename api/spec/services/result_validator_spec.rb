require 'rails_helper'

RSpec.describe Portfolios::ResultValidator do
  let(:session) { assessment_session(organization) }
  let(:payload) do
    {'configured_skills' => [{'skill_id' => 'ruby', 'skill_label' => 'Ruby', 'level' => 3,
      'confidence' => 'high', 'evidence' => ['I test my code'], 'competency_summary' => 'Uses tests'}], 'discovered_skills' => []}
  end
  before { session.transcript_turns.create!(turn_number: 1, speaker: 'candidate', text: 'I test my code before release.') }

  it 'accepts a numeric rating supported by a candidate quote' do
    expect(described_class.new(session).call(payload).first).to include(ai_level: 3, evidence: ['I test my code'])
  end

  [0, 6, 'L3', '3', 2.5, true, {}].each do |level|
    it "rejects malformed rating #{level.inspect}" do
      payload['configured_skills'][0]['level'] = level
      expect { described_class.new(session).call(payload) }.to raise_error(described_class::InvalidResult)
    end
  end

  it 'does not turn missing ratings into L1' do
    payload['configured_skills'][0]['level'] = nil
    expect(described_class.new(session).call(payload).first[:ai_level]).to be_nil
  end

  it 'does not trust a fabricated evidence quote' do
    payload['configured_skills'][0]['evidence'] = ['I led the entire engineering organization']
    expect(described_class.new(session).call(payload).first).to include(ai_level: nil, evidence: [])
  end

  it 'keeps omitted skills visible as unassessed' do
    payload['configured_skills'] = []
    expect(described_class.new(session).call(payload).first).to include(skill_label: 'Ruby', ai_level: nil)
  end

  it 'rejects duplicate and unknown skills' do
    payload['configured_skills'] *= 2
    expect { described_class.new(session).call(payload) }.to raise_error(described_class::InvalidResult)
    payload['configured_skills'] = [payload['configured_skills'].first.merge('skill_id' => 'invented')]
    expect { described_class.new(session).call(payload) }.to raise_error(described_class::InvalidResult)
  end

  it 'explains catalog mismatches without exposing transcript text' do
    payload['configured_skills'][0]['skill_id'] = 'invented'
    expect { described_class.new(session).call(payload) }
      .to raise_error(described_class::InvalidResult, /unknown or ambiguous configured skill.*invented/)
  end
end
