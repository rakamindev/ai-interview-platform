# frozen_string_literal: true

require 'spec_helper'
require_relative '../../../app/services/portfolios/skill_rows'

RSpec.describe Portfolios::SkillRows do
  def skill(overrides = {})
    {
      'skill_id' => 'sk-fe-001', 'skill_label' => 'React', 'level' => 3,
      'confidence' => 'high', 'evidence' => ['a quote'], 'competency_summary' => 'Solid.'
    }.merge(overrides)
  end

  describe '.call (configured skills)' do
    it 'keeps an assessed skill with its level, confidence and evidence' do
      rows = described_class.call([skill], coverage_states: { 'sk-fe-001' => 'covered' })

      expect(rows.size).to eq(1)
      expect(rows.first).to include(
        skill_id: 'sk-fe-001', skill_label: 'React', ai_level: 3,
        ai_confidence: 'high', is_discovered: false, evidence: ['a quote']
      )
    end

    it 'drops a skill the interview never reached, even if the model returned L1 for it' do
      rows = described_class.call([skill('level' => 1)], coverage_states: { 'sk-fe-001' => 'not_yet' })

      expect(rows).to be_empty
    end

    it 'matches an unreached custom skill (no skill_id) by label, ignoring case' do
      item = skill('skill_id' => nil, 'skill_label' => 'Testing & QA', 'level' => 1)
      rows = described_class.call([item], coverage_states: { 'testing & qa' => 'not_yet' })

      expect(rows).to be_empty
    end

    it 'keeps a skill that was only briefly explored (initiated)' do
      rows = described_class.call([skill('level' => 1, 'confidence' => 'low')],
                                  coverage_states: { 'sk-fe-001' => 'initiated' })

      expect(rows.map { |row| row[:ai_level] }).to eq([1])
    end

    it 'drops rows with a missing or out-of-range level instead of clamping them' do
      items = [nil, 0, 7, 'abc', 2.5].map { |level| skill('level' => level) }

      expect(described_class.call(items)).to be_empty
    end

    it 'accepts "L3" and "3" as level 3' do
      rows = described_class.call([skill('level' => 'L3'), skill('level' => '3')])

      expect(rows.map { |row| row[:ai_level] }).to eq([3, 3])
    end

    it 'falls back to low confidence for an unknown or missing value' do
      rows = described_class.call([skill('confidence' => 'certain'), skill('confidence' => nil)])

      expect(rows.map { |row| row[:ai_confidence] }).to eq(%w[low low])
    end

    it 'keeps at most 3 non-blank evidence quotes' do
      rows = described_class.call([skill('evidence' => ['one', '', 'two', '  ', 'three', 'four'])])

      expect(rows.first[:evidence]).to eq(%w[one two three])
    end

    it 'ignores entries that are not hashes or have no label' do
      rows = described_class.call(['junk', nil, skill('skill_label' => ' ')])

      expect(rows).to be_empty
    end

    it 'returns an empty list when the model returned nothing' do
      expect(described_class.call(nil)).to eq([])
    end
  end

  describe '.call (discovered skills)' do
    it 'marks rows as discovered, has no skill_id, and is not filtered by coverage' do
      item = skill('skill_label' => 'Micro-frontends', 'level' => 2)
      rows = described_class.call([item], coverage_states: { 'micro-frontends' => 'not_yet' }, discovered: true)

      expect(rows.first).to include(skill_id: nil, is_discovered: true, ai_level: 2)
    end
  end

  describe '.not_assessed' do
    it 'lists configured labels that have no row, ignoring case' do
      missing = described_class.not_assessed(['React', 'Testing & QA', 'TypeScript'], ['react', 'typescript'])

      expect(missing).to eq(['Testing & QA'])
    end

    it 'handles nil inputs' do
      expect(described_class.not_assessed(nil, nil)).to eq([])
    end
  end
end
