# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Portfolios::SkillReconciler do
  let(:assessment) { create(:assessment) }
  let!(:react) { create(:assessment_skill, assessment: assessment, skill_id: 'SK-ENG-001', skill_label: 'React', display_order: 1) }
  let!(:rest)  { create(:assessment_skill, assessment: assessment, skill_id: nil, skill_label: 'REST API Design', display_order: 2) }

  def reconcile(response)
    described_class.new(assessment_skills: assessment.assessment_skills.order(:display_order), response: response).call
  end

  def rated(label, level: 3, confidence: 'high', evidence: ['I paginate with cursors.'], summary: 'Solid.')
    { 'skill_label' => label, 'level' => level, 'confidence' => confidence, 'evidence' => evidence, 'competency_summary' => summary }
  end

  def row(rows, label)
    rows.find { |r| r[:skill_label] == label }
  end

  it 'keeps a rating that has a readable level and candidate evidence' do
    rows = reconcile('configured_skills' => [rated('React', level: 'L4'), rated('REST API Design', level: 2)])

    expect(row(rows, 'React')).to include(ai_level: 4, ai_confidence: 'high', is_discovered: false)
    expect(row(rows, 'REST API Design')).to include(ai_level: 2)
  end

  describe 'not assessed instead of L1 (AC1)' do
    [nil, 'N/A', 'not_assessed', 0, 6, 3.7].each do |level|
      it "stores level #{level.inspect} as not assessed" do
        rows = reconcile('configured_skills' => [rated('React', level: level)])

        expect(row(rows, 'React')).to include(ai_level: nil, ai_confidence: nil)
      end
    end

    it 'stores a level with no candidate evidence as not assessed' do
      rows = reconcile('configured_skills' => [rated('React', level: 3, evidence: [])])

      expect(row(rows, 'React')).to include(ai_level: nil, ai_confidence: nil)
    end

    it 'ignores blank and non-string evidence entries' do
      rows = reconcile('configured_skills' => [rated('React', evidence: ['', '   ', nil, 42])])

      expect(row(rows, 'React')[:ai_level]).to be_nil
    end
  end

  it 'normalizes confidence (AC3)' do
    rows = reconcile('configured_skills' => [rated('React', confidence: 'High'), rated('REST API Design', confidence: 'certain')])

    expect(row(rows, 'React')[:ai_confidence]).to eq('high')
    expect(row(rows, 'REST API Design')[:ai_confidence]).to eq('low')
  end

  describe 'reconciliation with the assessment (AC4)' do
    it 'records a configured skill the model omitted as not assessed' do
      rows = reconcile('configured_skills' => [rated('React')])

      expect(rows.map { |r| r[:skill_label] }).to eq(['React', 'REST API Design'])
      expect(row(rows, 'REST API Design')).to include(ai_level: nil, is_discovered: false)
    end

    it 'takes skill_id from the assessment, never from the model' do
      rows = reconcile('configured_skills' => [rated('React').merge('skill_id' => 'MADE-UP')])

      expect(row(rows, 'React')[:skill_id]).to eq('SK-ENG-001')
    end

    it 'matches configured skills by skill_id or case-insensitive label' do
      rows = reconcile('configured_skills' => [rated('something else', level: 5).merge('skill_id' => 'sk-eng-001'),
                                               rated('  rest api design ', level: 2)])

      expect(row(rows, 'React')[:ai_level]).to eq(5)
      expect(row(rows, 'REST API Design')[:ai_level]).to eq(2)
    end

    it 'keeps the first entry when the model rates a skill twice' do
      rows = reconcile('configured_skills' => [rated('React', level: 2), rated('React', level: 5)])

      expect(rows.count { |r| r[:skill_label] == 'React' }).to eq(1)
      expect(row(rows, 'React')[:ai_level]).to eq(2)
    end

    it 'treats an unknown configured skill as discovered, kept only if assessed' do
      rows = reconcile('configured_skills' => [rated('GraphQL', level: 3), rated('Kubernetes', level: nil)])

      expect(row(rows, 'GraphQL')).to include(is_discovered: true, skill_id: nil, ai_level: 3)
      expect(row(rows, 'Kubernetes')).to be_nil
    end

    it 'drops discovered skills that are not assessed or duplicate a configured skill' do
      rows = reconcile('discovered_skills' => [rated('Mobile', level: nil), rated('react', level: 4), rated('Testing', level: 2)])

      expect(rows.select { |r| r[:is_discovered] }.map { |r| r[:skill_label] }).to eq(['Testing'])
    end
  end

  describe 'long and messy text' do
    it 'caps summaries, quotes and labels so they fit the columns and the UI' do
      rows = reconcile('configured_skills' => [rated('React', summary: 'x' * 5_000, evidence: ['y' * 2_000] * 5)],
                       'discovered_skills' => [rated('z' * 300, level: 2)])

      expect(row(rows, 'React')[:competency_summary].length).to be <= described_class::MAX_SUMMARY
      expect(row(rows, 'React')[:evidence].length).to eq(3)
      expect(row(rows, 'React')[:evidence].first.length).to be <= described_class::MAX_QUOTE
      expect(rows.last[:skill_label].length).to be <= 255
    end
  end

  describe 'malformed model output' do
    it 'parses a JSON string response' do
      rows = reconcile({ 'configured_skills' => [rated('React')] }.to_json)

      expect(row(rows, 'React')[:ai_level]).to eq(3)
    end

    ['Sorry, I cannot help with that.', '[1, 2]', [1, 2], nil, 42].each do |response|
      it "rejects #{response.inspect} with a readable error" do
        expect { reconcile(response) }.to raise_error(described_class::MalformedResponse, /expected a JSON object/)
      end
    end

    it 'ignores skill entries that are not objects' do
      rows = reconcile('configured_skills' => ['React', nil, rated('React')], 'discovered_skills' => 'oops')

      expect(row(rows, 'React')[:ai_level]).to eq(3)
    end
  end
end
