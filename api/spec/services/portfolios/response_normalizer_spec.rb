# frozen_string_literal: true

require 'rails_helper'

# Each example here is one row of the acceptance criteria in assessment/REPORT.md.
RSpec.describe Portfolios::ResponseNormalizer do
  Map  = Struct.new(:skill_id, :skill_label, :is_discovered, :state, :probe_count, keyword_init: true)
  Line = Struct.new(:turn_number, :text)

  let(:react)  { Map.new(skill_id: 'sk-eng-001', skill_label: 'React / Frontend Development', is_discovered: false, state: 'covered', probe_count: 5) }
  let(:comms)  { Map.new(skill_id: nil, skill_label: 'Communication', is_discovered: false, state: 'partial', probe_count: 2) }
  let(:design) { Map.new(skill_id: nil, skill_label: 'System Design', is_discovered: false, state: 'not_yet', probe_count: 0) }
  let(:maps)   { [react, comms, design] }

  let(:candidate_turns) do
    [
      Line.new(2, 'We moved critical real-time data into useRef for things that do not need to trigger renders.'),
      Line.new(4, 'I put together a one-pager with the profiling data and shared it in Slack before the meeting.'),
      Line.new(6, 'We split the monolith into four micro-frontends using Module Federation.')
    ]
  end

  let(:react_entry) do
    { 'skill_id' => 'sk-eng-001', 'skill_label' => 'React / Frontend Development', 'level' => 3, 'confidence' => 'high',
      'evidence' => ['We moved critical real-time data into useRef'], 'competency_summary' => 'Solid state management.' }
  end
  let(:comms_entry) do
    { 'skill_label' => 'Communication', 'level' => 2, 'confidence' => 'high',
      'evidence' => ['I put together a one-pager with the profiling data'], 'competency_summary' => 'Clear 1:1.' }
  end

  subject(:normalizer) { described_class.new(coverage_maps: maps, candidate_turns:) }

  def row(rows, label) = rows.find { |r| r[:skill_label] == label }

  describe 'unassessed skills' do
    it 'records a never-reached skill as not assessed even when the model rates it' do
      design_entry = { 'skill_label' => 'System Design', 'level' => 1, 'confidence' => 'low', 'evidence' => [], 'competency_summary' => 'n/a' }
      rows = normalizer.call('configured_skills' => [react_entry, comms_entry, design_entry])

      expect(row(rows, 'System Design')).to include(
        assessment_status: 'not_assessed', status_reason: 'never_reached', ai_level: nil, ai_confidence: nil, evidence: []
      )
    end

    it 'records a probed skill the model left out as not assessed (model_omitted)' do
      rows = normalizer.call('configured_skills' => [react_entry])

      expect(row(rows, 'Communication')).to include(assessment_status: 'not_assessed', status_reason: 'model_omitted', ai_level: nil)
    end

    it 'always returns exactly one row per configured skill, in coverage order' do
      rows = normalizer.call('configured_skills' => [comms_entry, react_entry, react_entry])
      expect(rows.map { |r| r[:skill_label] }).to eq(['React / Frontend Development', 'Communication', 'System Design'])
    end
  end

  describe 'missing or malformed ratings' do
    {
      nil      => nil,
      'L3'     => 3,
      ' l4 '   => 4,
      '2'      => 2,
      3.0      => 3,
      3.7      => 3,
      '3.5'    => 3,
      0        => nil,
      6        => nil,
      -1       => nil,
      'high'   => nil,
      'L3-L4'  => nil,
      [3]      => nil,
      true     => nil
    }.each do |raw, expected|
      it "maps level #{raw.inspect} to #{expected.inspect}" do
        rows = normalizer.call('configured_skills' => [react_entry.merge('level' => raw), comms_entry])
        react_row = row(rows, 'React / Frontend Development')

        if expected
          expect(react_row).to include(assessment_status: 'assessed', ai_level: expected)
        else
          expect(react_row).to include(assessment_status: 'not_assessed', status_reason: 'invalid_level', ai_level: nil)
        end
      end
    end
  end

  describe 'confidence' do
    it 'derives confidence from coverage, ignoring what the model claims' do
      rows = normalizer.call('configured_skills' => [react_entry.merge('confidence' => 'low'), comms_entry])

      expect(row(rows, 'React / Frontend Development')[:ai_confidence]).to eq('high')   # covered, 5 probes
      expect(row(rows, 'Communication')[:ai_confidence]).to eq('medium')                # model said high
    end

    it 'is low when covered with only one probe' do
      react.probe_count = 1
      rows = normalizer.call('configured_skills' => [react_entry, comms_entry])
      expect(row(rows, 'React / Frontend Development')[:ai_confidence]).to eq('low')
    end

    it 'drops to low when none of the quotes can be found in the transcript' do
      rows = normalizer.call('configured_skills' => [react_entry.merge('evidence' => ['I invented React']), comms_entry])
      expect(row(rows, 'React / Frontend Development')).to include(ai_confidence: 'low', evidence: [], unverified_evidence_count: 1)
    end
  end

  describe 'evidence' do
    it 'keeps only quotes the candidate said, with the turn they came from' do
      entry = react_entry.merge('evidence' => [
        'We moved critical real-time data into useRef',
        'I always write tests first',                           # never said
        'We moved critical real-time data into useRef',         # duplicate
        42
      ])
      rows = normalizer.call('configured_skills' => [entry, comms_entry])

      expect(row(rows, 'React / Frontend Development')).to include(
        evidence:                  ['We moved critical real-time data into useRef'],
        evidence_refs:             [{ quote: 'We moved critical real-time data into useRef', turn_number: 2 }],
        unverified_evidence_count: 3
      )
    end

    it 'caps evidence at three quotes' do
      quotes = ['We moved critical real-time data', 'real-time data into useRef', 'things that do not need to trigger renders',
                'do not need to trigger renders']
      rows = normalizer.call('configured_skills' => [react_entry.merge('evidence' => quotes), comms_entry])
      expect(row(rows, 'React / Frontend Development')[:evidence].size).to eq(3)
    end

    it 'treats a non-list evidence field as no evidence' do
      rows = normalizer.call('configured_skills' => [react_entry.merge('evidence' => 'one quote as a string'), comms_entry])
      expect(row(rows, 'React / Frontend Development')).to include(evidence: [], ai_confidence: 'low')
    end
  end

  describe 'long and empty text' do
    it 'truncates very long summaries on a word boundary' do
      long = ('word ' * 1_000).strip
      rows = normalizer.call('configured_skills' => [react_entry.merge('competency_summary' => long), comms_entry])
      summary = row(rows, 'React / Frontend Development')[:competency_summary]

      expect(summary.length).to be <= described_class::MAX_SUMMARY_CHARS
      expect(summary).to end_with('…')
    end

    it 'fills an empty summary with an explicit placeholder' do
      rows = normalizer.call('configured_skills' => [react_entry.merge('competency_summary' => '  '), comms_entry])
      expect(row(rows, 'React / Frontend Development')[:competency_summary]).to match(/did not provide a summary/)
    end
  end

  describe 'discovered skills' do
    let(:mfe) { Map.new(skill_id: nil, skill_label: 'Micro-frontend Architecture', is_discovered: true, state: 'partial', probe_count: 2) }
    let(:maps) { [react, comms, design, mfe] }

    it 'keeps a discovered skill with a valid level and verified evidence' do
      entry = { 'skill_label' => 'Micro-frontend Architecture', 'level' => 2,
                'evidence' => ['split the monolith into four micro-frontends'], 'competency_summary' => 'Hands-on.' }
      rows = normalizer.call('configured_skills' => [react_entry, comms_entry], 'discovered_skills' => [entry])

      expect(row(rows, 'Micro-frontend Architecture')).to include(is_discovered: true, ai_level: 2, ai_confidence: 'medium')
    end

    it 'drops discovered skills with no verified evidence, no level, or a configured label' do
      rows = normalizer.call(
        'configured_skills' => [react_entry, comms_entry],
        'discovered_skills' => [
          { 'skill_label' => 'Kubernetes', 'level' => 4, 'evidence' => ['I run clusters'] },
          { 'skill_label' => 'Micro-frontend Architecture', 'level' => nil, 'evidence' => ['split the monolith into four micro-frontends'] },
          { 'skill_label' => 'communication', 'level' => 3, 'evidence' => ['I put together a one-pager with the profiling data'] }
        ]
      )
      expect(rows.count { |r| r[:is_discovered] }).to eq(0)
    end
  end

  describe 'unusable responses' do
    it 'rejects a response that is not an object' do
      expect { normalizer.call(['configured_skills']) }.to raise_error(described_class::InvalidResponse)
      expect { normalizer.call('just text') }.to raise_error(described_class::InvalidResponse)
    end

    it 'rejects an empty object when skills were probed (instead of saving an empty portfolio)' do
      expect { normalizer.call({}) }.to raise_error(described_class::InvalidResponse, /no skill ratings/)
    end

    it 'rejects configured_skills that is not a list' do
      expect { normalizer.call('configured_skills' => { 'a' => 1 }) }.to raise_error(described_class::InvalidResponse)
    end

    it 'accepts an empty response when no skill was ever probed, marking all not assessed' do
      maps.each { |m| m.probe_count = 0; m.state = 'not_yet' }
      rows = normalizer.call({})
      expect(rows.map { |r| r[:assessment_status] }.uniq).to eq(['not_assessed'])
    end
  end
end
