# frozen_string_literal: true

RSpec.describe Portfolios::ResponseValidator do
  let(:configured_skill) { Struct.new(:skill_id, :skill_label).new('SK-ENG-001', 'React') }
  let(:quote) { 'I measured rerenders with the React Profiler.' }
  let(:valid_item) do
    { 'skill_id' => 'SK-ENG-001', 'skill_label' => 'React', 'level' => 3,
      'confidence' => 'medium', 'evidence' => [quote],
      'competency_summary' => 'Synthetic assessment only.' }
  end

  def validate(item, turns: [quote])
    described_class.new(response: { 'configured_skills' => [item], 'discovered_skills' => [] },
                        configured_skills: [configured_skill], candidate_turns: turns).call
  end

  it 'keeps a verified integer rating and candidate quote' do
    expect(validate(valid_item).first).to include(ai_level: 3, skill_id: 'SK-ENG-001', evidence: [quote])
  end

  it 'never coerces a missing or string level to L1' do
    [nil, 'L3', '3', 0, 6, {}].each do |value|
      expect { validate(valid_item.merge('level' => value)) }.to raise_error(ArgumentError, /Invalid skill level/)
    end
  end

  it 'rejects a quote absent from candidate speech' do
    expect { validate(valid_item, turns: ['A different answer.']) }.to raise_error(ArgumentError, /Unverified/)
  end

  it 'rejects one-character fragments even when they occur in candidate speech' do
    ['I', 'a'].each do |fragment|
      expect { validate(valid_item.merge('evidence' => [fragment]),
                        turns: ['I am a React developer.']) }
        .to raise_error(ArgumentError, /Unverified candidate quote/)
    end
  end

  it 'represents absent evidence as an unassessed skill rather than a rating' do
    expect(validate(valid_item.merge('evidence' => []))).to eq([])
  end

  it 'does not invent an omitted configured skill' do
    validator = described_class.new(response: { 'configured_skills' => [] },
                                    configured_skills: [configured_skill], candidate_turns: [quote])

    expect(validator.call).to eq([])
  end

  it 'rejects repeated skill entries' do
    response = { 'configured_skills' => [valid_item, valid_item], 'discovered_skills' => [] }
    validator = described_class.new(response: response, configured_skills: [configured_skill], candidate_turns: [quote])

    expect { validator.call }.to raise_error(ArgumentError, /Duplicate/)
  end

  it 'rejects a matching configured ID with a conflicting label' do
    expect { validate(valid_item.merge('skill_label' => 'Vue')) }.to raise_error(ArgumentError, /Conflicting/)
  end

  it 'does not include malformed model content in the raised error' do
    validator = described_class.new(response: '{"private":"Synthetic candidate answer"',
                                    configured_skills: [configured_skill], candidate_turns: [quote])

    expect { validator.call }.to raise_error(ArgumentError, 'Invalid portfolio response JSON')
  end
end
