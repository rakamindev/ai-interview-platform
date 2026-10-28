# frozen_string_literal: true

require 'rails_helper'

# Validates one skill entry from the model output against the coverage map.
# "No evidence, no level": a level is kept only when the skill was probed
# (coverage partial or covered), the model returned an integer 1..5, and at
# least one evidence quote exists. Confidence is computed from coverage
# (PRD-01 section 5), never taken from the model.
RSpec.describe Portfolios::RatingNormalizer do
  def coverage(state: 'covered', probe_count: 3)
    build(:coverage_map, state: state, probe_count: probe_count)
  end

  def skill(overrides = {})
    {
      'skill_id' => 'sk-contoh-001',
      'skill_label' => 'Ruby on Rails',
      'level' => 3,
      'confidence' => 'high',
      'evidence' => ['Kandidat Contoh: saya memecah migrasi besar.'],
      'competency_summary' => 'Contoh ringkasan.'
    }.merge(overrides)
  end

  def normalize(data, coverage_map = coverage)
    described_class.call(data, coverage: coverage_map)
  end

  it 'keeps a valid, evidenced level for a covered skill' do
    expect(normalize(skill)).to include(rating_status: 'assessed', ai_level: 3, not_assessed_reason: nil,
                                        coverage_state: 'covered', probe_count: 3)
  end

  describe 'coverage gate (AC-01)' do
    [['not_yet', 0], ['initiated', 1]].each do |state, probes|
      it "marks a #{state} skill as not covered even when the model returned a level" do
        expect(normalize(skill, coverage(state: state, probe_count: probes)))
          .to include(rating_status: 'not_assessed', not_assessed_reason: 'not_covered',
                      ai_level: nil, ai_confidence: nil)
      end
    end

    it 'marks a skill without any coverage entry as not covered' do
      expect(normalize(skill, nil)).to include(rating_status: 'not_assessed', not_assessed_reason: 'not_covered')
    end
  end

  it 'marks a missing level as not assessed (AC-02)' do
    expect(normalize(skill('level' => nil)))
      .to include(rating_status: 'not_assessed', not_assessed_reason: 'no_level_from_model', ai_level: nil)
  end

  describe 'level parsing (AC-03, AC-04)' do
    ['L3', 'tiga', 3.5, '3.0', true, '', 0, -1, 6, 7].each do |raw|
      it "rejects #{raw.inspect} instead of coercing it" do
        expect(normalize(skill('level' => raw)))
          .to include(rating_status: 'not_assessed', not_assessed_reason: 'invalid_level_from_model', ai_level: nil)
      end
    end

    it 'accepts a numeric string such as "4"' do
      expect(normalize(skill('level' => '4'))).to include(rating_status: 'assessed', ai_level: 4)
    end
  end

  describe 'confidence from coverage, not from the model (AC-05, AC-11)' do
    it 'ignores a confidence outside the enum' do
      expect(normalize(skill('confidence' => 'very_high'))).to include(rating_status: 'assessed', ai_confidence: 'high')
    end

    it 'ignores a missing confidence' do
      expect(normalize(skill.except('confidence'))).to include(rating_status: 'assessed', ai_confidence: 'high')
    end

    {
      ['covered', 3] => 'high',
      ['covered', 5] => 'high',
      ['covered', 2] => 'medium',
      ['partial', 2] => 'medium',
      ['partial', 4] => 'medium',
      ['partial', 1] => 'low'
    }.each do |(state, probes), expected|
      it "is #{expected} for #{state} with #{probes} probes" do
        model_says_opposite = expected == 'high' ? 'low' : 'high'
        result = normalize(skill('confidence' => model_says_opposite), coverage(state: state, probe_count: probes))

        expect(result[:ai_confidence]).to eq(expected)
      end
    end
  end

  describe 'evidence (AC-06, AC-07)' do
    it 'wraps a single string quote into a list' do
      expect(normalize(skill('evidence' => 'Kandidat Contoh: satu kutipan.')))
        .to include(rating_status: 'assessed', evidence: ['Kandidat Contoh: satu kutipan.'])
    end

    [42, { 'quote' => 'x' }, nil, [], ['', '   '], [1, nil]].each do |raw|
      it "treats #{raw.inspect} as no evidence" do
        expect(normalize(skill('evidence' => raw)))
          .to include(rating_status: 'not_assessed', not_assessed_reason: 'no_evidence', ai_level: nil, evidence: [])
      end
    end

    it 'keeps at most three quotes and drops non-string entries' do
      quotes = ['a', 7, 'b', 'c', 'd']

      expect(normalize(skill('evidence' => quotes))[:evidence]).to eq(%w[a b c])
    end
  end

  describe 'long text (AC-12)' do
    it 'truncates a skill label longer than 255 characters' do
      label = 'Contoh label sangat panjang ' * 20

      result = normalize(skill('skill_label' => label))

      expect(result[:skill_label].length).to eq(255)
      expect(result[:skill_label]).to end_with('...')
    end

    it 'keeps a 5,000 character evidence quote intact' do
      quote = 'k' * 5_000

      expect(normalize(skill('evidence' => [quote]))[:evidence]).to eq([quote])
    end
  end

  it 'returns nil for an entry without a usable skill label' do
    expect(normalize(skill('skill_label' => '  '))).to be_nil
    expect(normalize(skill('skill_label' => 12))).to be_nil
  end

  it 'stores an empty summary instead of failing when the summary is missing' do
    expect(normalize(skill('competency_summary' => nil))[:competency_summary]).to eq('')
  end
end
