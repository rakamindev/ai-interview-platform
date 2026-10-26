# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGap::Comparator do
  def requirement(label, expected, skill_id: nil)
    FitGap::Comparator::Requirement.new(skill_id:, skill_label: label, expected_level: expected)
  end

  def rating(label, level, confidence: 'high', skill_id: nil, override_level: nil, notes: nil)
    FitGap::Comparator::Rating.new(
      skill_id:, skill_label: label, ai_level: level, ai_confidence: confidence,
      override_level:, assessor_notes: notes
    )
  end

  def compare(requirements, ratings)
    described_class.new(requirements:, ratings:).call
  end

  def row(result, label) = result.comparisons.find { |c| c[:skill_label] == label }

  describe 'level comparison (AC1)' do
    subject(:result) do
      compare(
        [requirement('React', 3), requirement('Communication', 3), requirement('System Design', 2)],
        [rating('React', 3), rating('Communication', 2), rating('System Design', 3)]
      )
    end

    it 'classifies match, gap and exceed with a signed delta' do
      expect(row(result, 'React')).to include(result: 'match', delta: 0, expected_level: 3, candidate_level: 3)
      expect(row(result, 'Communication')).to include(result: 'gap', delta: -1)
      expect(row(result, 'System Design')).to include(result: 'exceed', delta: 1)
    end

    it 'keeps vacancy order' do
      expect(result.comparisons.map { |c| c[:skill_label] }).to eq(['React', 'Communication', 'System Design'])
    end
  end

  describe 'matching skills' do
    it 'prefers skill_id over label' do
      result = compare([requirement('Frontend', 3, skill_id: 'sk-1')], [rating('React (renamed)', 4, skill_id: 'sk-1')])

      expect(row(result, 'Frontend')).to include(result: 'exceed', candidate_level: 4)
    end

    it 'matches labels regardless of case, whitespace and punctuation' do
      result = compare([requirement('React / Frontend Development', 3)],
                       [rating("  react/frontend   DEVELOPMENT. ", 3)])

      expect(row(result, 'React / Frontend Development')).to include(result: 'match')
    end

    it 'matches labels with Indonesian diacritics and non-latin text intact' do
      result = compare([requirement('Komunikasi Lintas Tim — Négosiasi', 2)],
                       [rating('komunikasi lintas tim négosiasi', 2)])

      expect(row(result, 'Komunikasi Lintas Tim — Négosiasi')).to include(result: 'match')
    end
  end

  describe 'skills that were never assessed (AC2)' do
    subject(:result) { compare([requirement('Kubernetes', 2)], [rating('React', 3)]) }

    it 'is not_assessed, never a gap' do
      expect(row(result, 'Kubernetes')).to include(
        result: 'not_assessed', candidate_level: nil, delta: nil, not_assessed_reason: 'not_probed'
      )
    end

    it 'is counted separately in the summary' do
      expect(result.summary).to include(total: 1, gap: 0, not_assessed: 1)
    end
  end

  describe 'missing or corrupt ratings (AC3)' do
    [nil, 0, 6, 'three', 2.5].each do |bad_level|
      it "treats ai_level=#{bad_level.inspect} as not_assessed without raising" do
        result = compare([requirement('React', 3)], [rating('React', bad_level)])

        expect(row(result, 'React')).to include(result: 'not_assessed', not_assessed_reason: 'invalid_rating',
                                                candidate_level: nil, delta: nil)
      end
    end

    it 'treats an invalid expected level as not comparable' do
      result = compare([requirement('React', nil)], [rating('React', 3)])

      expect(row(result, 'React')).to include(result: 'not_assessed', not_assessed_reason: 'invalid_expectation')
    end
  end

  describe 'assessor overrides (AC4)' do
    subject(:result) do
      compare([requirement('Communication', 3)],
              [rating('Communication', 2, confidence: 'low', override_level: 3, notes: 'Strong async writing sample')])
    end

    it 'uses the override as the candidate level and keeps the AI level for audit' do
      expect(row(result, 'Communication')).to include(
        candidate_level: 3, ai_level: 2, is_override: true, assessor_notes: 'Strong async writing sample',
        result: 'match', delta: 0
      )
    end

    it 'does not ask for verification once a human has judged the skill' do
      expect(row(result, 'Communication')).to include(needs_verification: false)
    end

    it 'falls back to the AI level when the override is out of range' do
      result = compare([requirement('React', 3)], [rating('React', 2, override_level: 9)])

      expect(row(result, 'React')).to include(candidate_level: 2, is_override: false)
    end
  end

  describe 'low-confidence ratings (AC5)' do
    it 'still computes the result but flags it for verification' do
      result = compare([requirement('Communication', 3)], [rating('Communication', 2, confidence: 'low')])

      expect(row(result, 'Communication')).to include(result: 'gap', needs_verification: true, confidence: 'low')
      expect(result.summary).to include(gap: 1, needs_verification: 1)
    end

    it 'normalises confidence casing from the model' do
      result = compare([requirement('React', 3)], [rating('React', 3, confidence: ' LOW ')])

      expect(row(result, 'React')).to include(confidence: 'low', needs_verification: true)
    end

    it 'treats unknown confidence as needing verification' do
      result = compare([requirement('React', 3)], [rating('React', 3, confidence: nil)])

      expect(row(result, 'React')).to include(confidence: nil, needs_verification: true)
    end
  end

  describe 'empty inputs (AC6)' do
    it 'returns empty comparisons and zeroed summary for a vacancy without skills' do
      result = compare([], [rating('React', 3)])

      expect(result.comparisons).to eq([])
      expect(result.summary).to eq(total: 0, match: 0, gap: 0, exceed: 0, not_assessed: 0, needs_verification: 0)
    end
  end

  it 'ignores ratings for skills the vacancy does not require (AC7)' do
    result = compare([requirement('React', 3)], [rating('React', 3), rating('Micro-frontends', 2)])

    expect(result.comparisons.map { |c| c[:skill_label] }).to eq(['React'])
  end

  it 'returns JSON-safe, string-keyable rows' do
    result = compare([requirement('React', 3)], [rating('React', 3)])

    expect(JSON.parse(result.comparisons.to_json).first.keys).to include(
      'skill_label', 'skill_id', 'expected_level', 'candidate_level', 'ai_level', 'is_override',
      'assessor_notes', 'confidence', 'needs_verification', 'result', 'delta', 'not_assessed_reason'
    )
  end
end
