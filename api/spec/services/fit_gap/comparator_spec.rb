# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGap::Comparator do
  let(:portfolio) { create(:portfolio) }
  let(:vacancy)   { create(:vacancy) }

  def compare
    described_class.new(portfolio: portfolio.reload, vacancy: vacancy.reload).call
  end

  def row_for(label)
    compare.find { |c| c[:skill_label] == label }
  end

  def require_skill(label, level, **attrs)
    create(:vacancy_skill, vacancy: vacancy, skill_label: label, expected_level: level, **attrs)
  end

  def rate(label, level, confidence: 'high', **attrs)
    create(:portfolio_skill, portfolio: portfolio, skill_label: label, ai_level: level,
                             ai_confidence: confidence, **attrs)
  end

  describe 'skills rated with enough evidence' do
    before { require_skill('SQL', 3) }

    it 'is a match when the level meets the expectation' do
      rate('SQL', 3)
      expect(row_for('SQL')).to include(result: 'match', candidate_level: 3, expected_level: 3, delta: 0)
    end

    it 'exceeds when the level is above the expectation' do
      rate('SQL', 5, confidence: 'medium')
      expect(row_for('SQL')).to include(result: 'exceed', candidate_level: 5, delta: 2)
    end

    it 'is a gap when the level is below the expectation' do
      rate('SQL', 1)
      expect(row_for('SQL')).to include(result: 'gap', candidate_level: 1, delta: -2)
    end
  end

  describe 'skills the AI rated from a brief exchange (confidence low)' do
    before { require_skill('System Design', 4) }

    it 'never presents a provisional rating as a gap' do
      rate('System Design', 2, confidence: 'low')

      expect(row_for('System Design')).to include(
        result: 'insufficient_evidence',
        provisional_result: 'gap',
        ai_level: 2,
        candidate_level: nil,
        delta: nil
      )
    end

    it 'does not present a provisional rating as a strength either' do
      rate('System Design', 5, confidence: 'low')
      expect(row_for('System Design')).to include(result: 'insufficient_evidence', provisional_result: 'exceed')
    end

    it 'links the row to the portfolio skill an assessor needs to confirm' do
      skill = rate('System Design', 2, confidence: 'low')
      expect(row_for('System Design')).to include(portfolio_skill_id: skill.id, overridden: false)
    end

    it 'becomes a verdict once an assessor confirms a level' do
      skill = rate('System Design', 2, confidence: 'low')
      create(:assessor_override, portfolio_skill: skill, override_level: 2)

      expect(row_for('System Design')).to include(
        result: 'gap', candidate_level: 2, ai_level: 2, overridden: true, provisional_result: nil
      )
    end
  end

  describe 'assessor overrides' do
    it 'take precedence over the AI level' do
      require_skill('Testing', 3)
      skill = rate('Testing', 2)
      create(:assessor_override, portfolio_skill: skill, override_level: 4)

      expect(row_for('Testing')).to include(result: 'exceed', candidate_level: 4, ai_level: 2, overridden: true)
    end
  end

  describe 'skills the interview never reached' do
    it 'are not assessed, with no level and no delta' do
      require_skill('Kubernetes', 3)

      expect(row_for('Kubernetes')).to include(
        result: 'not_assessed', candidate_level: nil, ai_level: nil, delta: nil, portfolio_skill_id: nil
      )
    end
  end

  describe 'matching a requirement to a rated skill' do
    it 'matches skill ids regardless of case' do
      require_skill('React', 3, skill_id: 'SK-ENG-001')
      rate('React / Frontend', 3, skill_id: 'sk-eng-001')

      expect(row_for('React')).to include(result: 'match')
    end

    it 'matches labels regardless of case and spacing' do
      require_skill('Data  Modelling ', 3)
      rate('data modelling', 3)

      expect(compare.sole).to include(result: 'match')
    end

    it 'prefers the configured skill over a discovered one with the same label' do
      require_skill('Go', 3)
      rate('Go', 1, is_discovered: true)
      rate('Go', 3, is_discovered: false)

      expect(compare.sole).to include(result: 'match')
    end
  end

  describe 'vacancy edge cases' do
    it 'returns no rows when the vacancy has no requirements' do
      rate('SQL', 3)
      expect(compare).to eq([])
    end

    it 'keeps one row per skill, using the stricter expectation when a requirement is duplicated' do
      require_skill('SQL', 2)
      require_skill('sql', 4)
      rate('SQL', 3)

      expect(compare.sole).to include(expected_level: 4, result: 'gap')
    end
  end

  it 'orders rows by what needs a decision first' do
    require_skill('A-exceed', 1)
    require_skill('B-match', 3)
    require_skill('C-unrated', 3)
    require_skill('D-review', 3)
    require_skill('E-gap', 4)
    rate('A-exceed', 3)
    rate('B-match', 3)
    rate('D-review', 3, confidence: 'low')
    rate('E-gap', 2)

    expect(compare.map { |c| c[:result] })
      .to eq(%w[gap insufficient_evidence not_assessed match exceed])
  end
end
