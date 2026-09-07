# frozen_string_literal: true

require 'spec_helper'
# When the whole suite runs, Rails is already booted and Zeitwerk owns these
# constants. Only load them by hand for the database-free subset.
unless defined?(Rails)
  require_relative '../../../app/services/portfolios/skill_payload'
end

RSpec.describe Portfolios::SkillPayload do
  # NOTE: `overrides` is positional and braces are explicit at every call site.
  # A trailing brace-less hash next to a keyword parameter is parsed as keywords
  # under Ruby 3 and raises ArgumentError.
  def payload(overrides = {}, discovered = false)
    described_class.parse(
      {
        'skill_id'           => 'sk-eng-001',
        'skill_label'        => 'React / Frontend Development',
        'level'              => 3,
        'confidence'         => 'high',
        'evidence'           => ['quote one', 'quote two'],
        'competency_summary' => 'Consistent L3 behaviour across several probes.'
      }.merge(overrides),
      discovered: discovered
    )
  end

  it 'accepts a well-formed entry' do
    expect(payload).to be_valid
    expect(payload.level).to eq(3)
  end

  # The P0 itself: `nil.to_i.clamp(1, 5)` used to turn "no rating" into a real L1.
  it 'rejects a missing level instead of silently scoring it L1' do
    result = payload({ 'level' => nil })

    expect(result).not_to be_valid
    expect(result.rejection_reason).to eq(:invalid_level)
    expect(result.level).to be_nil
  end

  it 'rejects a non-numeric level instead of coercing it to L1' do
    %w[unknown N/A L3 --].each do |value|
      result = payload({ 'level' => value })

      expect(result).not_to be_valid, "expected #{value.inspect} to be rejected"
      expect(result.level).to be_nil
    end
  end

  it 'rounds a float level that the model returned' do
    expect(payload({ 'level' => 3.6 }).level).to eq(4)
    expect(payload({ 'level' => '2.4' }).level).to eq(2)
  end

  it 'clamps an out-of-range level that is still genuinely a number' do
    expect(payload({ 'level' => 0 }).level).to eq(1)
    expect(payload({ 'level' => 9 }).level).to eq(5)
  end

  it 'rejects an entry with no skill label' do
    expect(payload({ 'skill_label' => '  ' })).not_to be_valid
  end

  it 'rejects an entry with no competency summary, since the column requires one' do
    expect(payload({ 'competency_summary' => nil }).rejection_reason).to eq(:missing_summary)
  end

  it 'degrades an unrecognised confidence to the most cautious value' do
    expect(payload({ 'confidence' => 'very-high' }).confidence).to eq('low')
    expect(payload({ 'confidence' => nil }).confidence).to eq('low')
  end

  it 'keeps at most three non-empty evidence quotes' do
    result = payload({ 'evidence' => ['a', '', '  ', 'b', 'c', 'd'] })

    expect(result.evidence).to eq(%w[a b c])
  end

  it 'never carries a skill_id onto a discovered skill' do
    expect(payload({ 'skill_id' => 'sk-eng-001' }, true).skill_id).to be_nil
  end

  it 'survives a non-hash entry without raising' do
    expect(described_class.parse('not a hash', discovered: false)).not_to be_valid
  end
end
