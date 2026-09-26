# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Portfolios::SkillResolver do
  def resolve(maps, configured: [], discovered: [])
    described_class.new(
      coverage_maps: maps,
      answer: { 'configured_skills' => configured, 'discovered_skills' => discovered }
    ).call
  end

  def coverage(label, **attrs)
    build(:coverage_map, skill_label: label, **attrs)
  end

  def rating(label, level: 3, **extra)
    { 'skill_label' => label, 'level' => level, 'confidence' => 'high',
      'evidence' => ['I measured the slow page before changing it.'],
      'competency_summary' => 'Finds the cause before fixing.' }.merge(extra.transform_keys(&:to_s))
  end

  describe 'a skill the interview never reached' do
    it 'is not assessed and has no level, even when the model gave one' do
      row = resolve([coverage('Leadership', state: 'not_yet', probe_count: 0)],
                    configured: [rating('Leadership', level: 1)]).first

      expect(row).to include(status: 'not_assessed', ai_level: nil, ai_confidence: nil, raw_level: nil)
    end

    it 'keeps nothing the model wrote about it' do
      row = resolve([coverage('Leadership', state: 'not_yet', probe_count: 0)],
                    configured: [rating('Leadership')]).first

      expect(row).to include(evidence: [], competency_summary: nil)
    end
  end

  describe 'a skill the model left out' do
    it 'could not be evaluated and has no level' do
      rows = resolve([coverage('React'), coverage('Testing')], configured: [rating('React')])

      expect(rows.last).to include(skill_label: 'Testing', status: 'unavailable', ai_level: nil)
    end
  end

  describe 'the level the model gave' do
    [nil, '', 'strong', 'L3', '3.0', ' 3', 0, 7, 3.5, [3], { 'value' => 3 }].each do |odd|
      it "is never turned into a number when it is #{odd.inspect}" do
        row = resolve([coverage('React')], configured: [rating('React', level: odd)]).first

        expect(row).to include(status: 'unavailable', ai_level: nil, ai_confidence: nil)
        expect(row[:raw_level]).to eq(odd.to_json)
      end
    end

    it 'could not be evaluated when it is missing, and there is no raw value to keep' do
      row = resolve([coverage('React')], configured: [rating('React').except('level')]).first

      expect(row).to include(status: 'unavailable', ai_level: nil, raw_level: nil)
    end

    it 'accepts a whole number from 1 to 5' do
      rows = resolve([coverage('A'), coverage('B')], configured: [rating('A', level: 1), rating('B', level: 5)])

      expect(rows.map { |r| r[:ai_level] }).to eq([1, 5])
    end

    it 'accepts a one-digit string such as "4"' do
      row = resolve([coverage('React')], configured: [rating('React', level: '4')]).first

      expect(row).to include(status: 'assessed', ai_level: 4)
    end
  end

  describe 'how much evidence a rated skill rests on' do
    it 'is thin when coverage moved on by itself, and confidence is never high' do
      map = coverage('React', state: 'covered', probe_count: 4,
                              last_signal: 'Auto-advanced: outside context window with sufficient probes')
      row = resolve([map], configured: [rating('React')]).first

      expect(row).to include(status: 'thin_evidence', caveat: 'auto_advanced', ai_level: 3)
      expect(row[:ai_confidence]).not_to eq('high')
    end

    it 'is thin when the interview asked one question or fewer' do
      row = resolve([coverage('React', state: 'partial', probe_count: 1)], configured: [rating('React')]).first

      expect(row).to include(status: 'thin_evidence', caveat: 'low_probe_count', ai_confidence: 'low')
    end

    it 'is enough otherwise' do
      row = resolve([coverage('React', state: 'partial', probe_count: 2)], configured: [rating('React')]).first

      expect(row).to include(status: 'assessed', caveat: nil, ai_level: 3)
    end
  end

  describe 'confidence' do
    {
      ['covered', 3]   => 'high',
      ['covered', 2]   => 'medium',
      ['partial', 2]   => 'medium',
      ['partial', 5]   => 'medium',
      ['initiated', 3] => 'low',
      ['partial', 1]   => 'low'
    }.each do |(state, probes), expected|
      it "is #{expected} for #{state} coverage with #{probes} questions, whatever the model says" do
        map = coverage('React', state: state, probe_count: probes)
        row = resolve([map], configured: [rating('React', confidence: 'High')]).first

        expect(row[:ai_confidence]).to eq(expected)
      end
    end
  end

  describe 'matching the answer to the configured skills' do
    it 'matches by skill id first, ignoring case' do
      map = coverage('React / Frontend Development', skill_id: 'SK-ENG-001')
      row = resolve([map], configured: [rating('React', skill_id: 'sk-eng-001', level: 4)]).first

      expect(row).to include(skill_id: 'SK-ENG-001', skill_label: 'React / Frontend Development', ai_level: 4)
    end

    it 'then by name, ignoring case and spaces' do
      row = resolve([coverage('System Design')], configured: [rating('  system design ', level: 2)]).first

      expect(row).to include(skill_label: 'System Design', ai_level: 2)
    end

    it 'ignores a rating for a skill the assessment does not have' do
      rows = resolve([coverage('React')], configured: [rating('React'), rating('Cooking')])

      expect(rows.map { |r| r[:skill_label] }).to eq(['React'])
    end
  end

  describe 'discovered skills' do
    it 'follow the same rules when the interview tracked them' do
      map = coverage('GraphQL', is_discovered: true, state: 'initiated', probe_count: 1)
      row = resolve([map], discovered: [rating('graphql', level: 2)]).first

      expect(row).to include(skill_label: 'GraphQL', is_discovered: true, skill_id: nil,
                             status: 'thin_evidence', probe_count: 1)
    end

    it 'take their status from the level alone when nothing was tracked' do
      rows = resolve([], discovered: [rating('Mentoring', level: 3), rating('Hiring', level: 'high')])

      expect(rows.first).to include(status: 'assessed', ai_level: 3, ai_confidence: 'low', coverage_state: nil)
      expect(rows.last).to include(status: 'unavailable', ai_level: nil)
    end

    it 'are skipped when the model gives no name' do
      expect(resolve([], discovered: [rating(''), rating(nil)])).to be_empty
    end
  end

  describe 'the text the model wrote' do
    it 'saves an empty summary as no summary, instead of failing the report' do
      row = resolve([coverage('React')], configured: [rating('React', competency_summary: '   ')]).first

      expect(row).to include(status: 'assessed', competency_summary: nil)
    end

    it 'keeps at most three quotes, and only real text' do
      quotes = ['One.', '', 7, 'Two.', 'Three.', 'Four.']
      row = resolve([coverage('React')], configured: [rating('React', evidence: quotes)]).first

      expect(row[:evidence]).to eq(['One.', 'Two.', 'Three.'])
    end
  end

  describe 'an answer that cannot be used' do
    [[], 'text', { 'skills' => [] }, { 'configured_skills' => 'none' }].each do |answer|
      it "raises for #{answer.inspect}" do
        resolver = described_class.new(coverage_maps: [coverage('React')], answer: answer)

        expect { resolver.call }.to raise_error(described_class::InvalidAnswer)
      end
    end
  end
end
