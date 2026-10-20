# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGap::Comparator do
  def compare(vacancy, portfolio)
    described_class.call(vacancy_skills: vacancy, portfolio_skills: portfolio)
  end

  def vac(label, level, skill_id: nil)
    { skill_label: label, expected_level: level, skill_id: skill_id }
  end

  def cand(label, level, confidence: 'high', override: nil, skill_id: nil)
    { skill_label: label, ai_level: level, confidence: confidence, override_level: override, skill_id: skill_id }
  end

  def only(result)
    result[:comparisons].first
  end

  describe 'result classification' do
    it 'is a match when levels are equal' do
      row = only(compare([vac('React', 3)], [cand('React', 3)]))
      expect(row).to include(result: 'match', delta: 0, candidate_level: 3, required_level: 3)
    end

    it 'is an exceed with a positive delta' do
      expect(only(compare([vac('React', 2)], [cand('React', 5)]))).to include(result: 'exceed', delta: 3)
    end

    it 'is a gap with a negative delta' do
      expect(only(compare([vac('React', 4)], [cand('React', 1)]))).to include(result: 'gap', delta: -3)
    end
  end

  describe 'unassessed skills' do
    it 'is not_assessed, never a gap, when the candidate has no matching skill' do
      row = only(compare([vac('Kubernetes', 3)], [cand('React', 5)]))
      expect(row).to include(result: 'not_assessed', candidate_level: nil, delta: nil, low_evidence: false)
    end

    it 'is not_assessed when the portfolio is empty' do
      expect(only(compare([vac('React', 3)], []))[:result]).to eq('not_assessed')
    end

    it 'is not_assessed when the matching skill has no level' do
      expect(only(compare([vac('React', 3)], [cand('React', nil)]))[:result]).to eq('not_assessed')
    end
  end

  describe 'matching' do
    it 'matches labels ignoring case and extra whitespace' do
      expect(only(compare([vac('  react   native ', 3)], [cand('React Native', 3)]))[:result]).to eq('match')
    end

    it 'matches by skill_id even when labels differ' do
      row = only(compare([vac('Frontend', 3, skill_id: 'sk-1')],
                         [cand('React / Frontend Development', 3, skill_id: 'sk-1')]))
      expect(row[:result]).to eq('match')
    end

    it 'does not match different skills with similar text' do
      expect(only(compare([vac('React', 3)], [cand('React Native', 3)]))[:result]).to eq('not_assessed')
    end
  end

  describe 'overrides' do
    it 'uses the assessor level over the AI level and flags it' do
      row = only(compare([vac('React', 3)], [cand('React', 1, override: 3)]))
      expect(row).to include(result: 'match', candidate_level: 3, ai_level: 1, is_override: true)
    end

    it 'does not flag low evidence once a human reviewed the rating' do
      row = only(compare([vac('React', 3)], [cand('React', 1, confidence: 'low', override: 2)]))
      expect(row[:low_evidence]).to be(false)
    end
  end

  describe 'low evidence' do
    it 'flags a low-confidence gap so the UI can say verify' do
      row = only(compare([vac('React', 4)], [cand('React', 1, confidence: 'low')]))
      expect(row).to include(result: 'gap', low_evidence: true)
    end

    it 'does not flag medium confidence' do
      expect(only(compare([vac('React', 4)], [cand('React', 1, confidence: 'medium')]))[:low_evidence]).to be(false)
    end
  end

  describe 'vacancy edge cases' do
    it 'returns an empty, well-formed result for a vacancy with no skills' do
      result = compare([], [cand('React', 3)])
      expect(result[:comparisons]).to eq([])
      expect(result[:summary]).to include(total: 0, assessed: 0, coverage_pct: nil)
    end

    it 'collapses duplicate required skills to the strictest level' do
      result = compare([vac('React', 2), vac('react', 4)], [cand('React', 3)])
      expect(result[:comparisons].size).to eq(1)
      expect(only(result)).to include(required_level: 4, result: 'gap')
    end

    it 'ignores blank labels' do
      expect(compare([vac('  ', 3)], [])[:comparisons]).to eq([])
    end

    it 'keeps the legacy expected_level key for existing export consumers' do
      expect(only(compare([vac('React', 3)], []))[:expected_level]).to eq(3)
    end
  end

  describe 'summary' do
    it 'counts every outcome and computes coverage' do
      result = compare(
        [vac('A', 3), vac('B', 3), vac('C', 3), vac('D', 3)],
        [cand('A', 3), cand('B', 5), cand('C', 1, confidence: 'low')]
      )
      expect(result[:summary]).to eq(
        total: 4, assessed: 3, match: 1, exceed: 1, gap: 1, not_assessed: 1,
        low_evidence: 1, overridden: 0, coverage_pct: 75
      )
    end

    it 'reports 0% coverage when nothing was assessed' do
      expect(compare([vac('A', 3)], [])[:summary]).to include(assessed: 0, coverage_pct: 0)
    end
  end
end
