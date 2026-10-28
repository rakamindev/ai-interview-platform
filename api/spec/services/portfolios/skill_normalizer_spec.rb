# frozen_string_literal: true

require 'rails_helper'

# AC1.1, AC2.1-2.4, AC3.4: turns one model entry plus one coverage-map row into the attributes of a
# portfolio skill. It never raises: bad model output is contained to the skill it belongs to.
RSpec.describe Portfolios::SkillNormalizer do
  def coverage(state: 'covered', probes: 3, skill_id: 'SK-ENG-001', label: 'React / Frontend Development Core',
               discovered: false)
    build(:coverage_map, state: state, probe_count: probes, skill_id: skill_id, skill_label: label,
                         is_discovered: discovered)
  end

  def entry(overrides = {})
    { 'skill_id' => 'SK-ENG-001', 'skill_label' => 'React', 'level' => 3, 'confidence' => 'high',
      'evidence' => ['I profile before I memoize.'], 'competency_summary' => 'Solid L3.' }.merge(overrides)
  end

  def normalize(entry_value, coverage_row = coverage)
    described_class.call(coverage: coverage_row, entry: entry_value)
  end

  describe 'identity' do
    it 'takes skill_id, label and discovered flag from the coverage map, not the model' do
      result = normalize(entry('skill_id' => 'sk-eng-001', 'skill_label' => 'Something else'))

      expect(result).to include(skill_id: 'SK-ENG-001', skill_label: 'React / Frontend Development Core',
                                is_discovered: false)
    end
  end

  describe 'not assessed (AC1.1)' do
    it 'ignores whatever the model says when coverage is not_yet' do
      result = normalize(entry('level' => 1, 'evidence' => ['made up']), coverage(state: 'not_yet', probes: 0))

      expect(result).to include(assessment_status: 'not_assessed', ai_level: nil, ai_confidence: nil,
                                evidence: [], competency_summary: '')
      expect(result[:status_reason]).to eq('Not discussed in the interview.')
    end

    it 'works without any model entry' do
      expect(normalize(nil, coverage(state: 'not_yet', probes: 0))[:assessment_status]).to eq('not_assessed')
    end
  end

  describe 'level parsing (AC2.1, AC2.2)' do
    [3, '3', 'L3', 'l3', ' L 3 ', 3.0].each do |raw|
      it "parses #{raw.inspect} as 3" do
        expect(normalize(entry('level' => raw))).to include(assessment_status: 'assessed', ai_level: 3)
      end
    end

    [nil, 0, 6, 7, -1, 2.5, 'three', 'L0', '', [], {}, true].each do |raw|
      it "flags #{raw.inspect} as needs_review instead of rating it" do
        result = normalize(entry('level' => raw))

        expect(result).to include(assessment_status: 'needs_review', ai_level: nil)
        expect(result[:status_reason]).to start_with('The AI returned an invalid level')
      end
    end

    it 'flags a missing entry for a discussed skill as needs_review (AC2.6)' do
      result = normalize(nil)

      expect(result).to include(assessment_status: 'needs_review', ai_level: nil)
      expect(result[:status_reason]).to eq('The AI returned no rating for this skill.')
    end

    it 'flags an entry that is not an object as needs_review' do
      expect(normalize('L3')[:assessment_status]).to eq('needs_review')
    end

    it 'does not put candidate text in the reason' do
      reason = normalize(entry('level' => 'the candidate said they are great'))[:status_reason]

      expect(reason.length).to be <= 80
    end
  end

  describe 'confidence (AC3.4)' do
    it 'computes confidence from coverage and ignores the model label' do
      result = normalize(entry('confidence' => 'High'), coverage(state: 'partial', probes: 2))

      expect(result[:ai_confidence]).to eq('medium')
    end

    it 'keeps the computed confidence on needs_review skills, so reviewers see how thin the evidence is' do
      result = normalize(entry('level' => nil), coverage(state: 'initiated', probes: 1))

      expect(result[:ai_confidence]).to eq('low')
    end
  end

  describe 'evidence (AC2.3)' do
    it 'keeps at most 3 non-blank strings, stripped, without duplicates' do
      raw = ['  one  ', '', nil, 42, 'one', 'two', 'three', 'four']

      expect(normalize(entry('evidence' => raw))[:evidence]).to eq(%w[one two three])
    end

    it 'wraps a single string' do
      expect(normalize(entry('evidence' => 'a quote'))[:evidence]).to eq(['a quote'])
    end

    it 'treats other shapes as no evidence' do
      expect(normalize(entry('evidence' => { 'a' => 1 }))[:evidence]).to eq([])
    end

    it 'truncates each quote to 500 characters' do
      quote = normalize(entry('evidence' => ['x' * 2_000]))[:evidence].first

      expect(quote.length).to eq(500)
    end
  end

  describe 'competency summary (AC2.4)' do
    it 'keeps the level when the summary is blank' do
      expect(normalize(entry('competency_summary' => '   '))).to include(ai_level: 3, competency_summary: '')
    end

    it 'treats a non-string summary as blank' do
      expect(normalize(entry('competency_summary' => ['a']))[:competency_summary]).to eq('')
    end

    it 'truncates very long summaries to 2,000 characters' do
      expect(normalize(entry('competency_summary' => 'y' * 9_000))[:competency_summary].length).to eq(2_000)
    end
  end
end
