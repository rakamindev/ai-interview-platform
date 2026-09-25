# frozen_string_literal: true

require_relative '../../../app/services/fit_gap/comparison_builder'

RSpec.describe FitGap::ComparisonBuilder do
  Override = Struct.new(:override_level)
  Skill = Struct.new(
    :id,
    :skill_id,
    :skill_label,
    :ai_level,
    :ai_confidence,
    :competency_summary,
    :evidence,
    :assessor_override,
    keyword_init: true
  ) do
    def evidence_quotes
      Array(evidence)
    end
  end
  VacancySkill = Struct.new(:skill_id, :skill_label, :expected_level, keyword_init: true)

  class FakeSkillAssociation
    def initialize(skills)
      @skills = skills
    end

    def includes(*)
      @skills
    end
  end

  def build_portfolio(*skills)
    Struct.new(:portfolio_skills).new(FakeSkillAssociation.new(skills))
  end

  def build_vacancy(*skills)
    Struct.new(:vacancy_skills).new(skills)
  end

  it 'uses the human override as the effective level and keeps the AI confidence visible' do
    portfolio = build_portfolio(
      Skill.new(
        id: 10,
        skill_id: 'react',
        skill_label: 'React',
        ai_level: 2,
        ai_confidence: 'medium',
        competency_summary: 'Evidence supports routine React delivery.',
        evidence: ['quote one', 'quote two'],
        assessor_override: Override.new(3)
      )
    )
    vacancy = build_vacancy(VacancySkill.new(skill_id: 'react', skill_label: 'React', expected_level: 3))

    comparison = described_class.new(portfolio: portfolio, vacancy: vacancy).call.first

    expect(comparison).to include(
      candidate_level: 3,
      expected_level: 3,
      result: 'match',
      delta: 0,
      confidence: 'medium',
      overridden: true,
      evidence_count: 2
    )
  end

  it 'falls back to a normalized skill label when a stable skill id is unavailable' do
    portfolio = build_portfolio(
      Skill.new(
        id: 11,
        skill_id: nil,
        skill_label: '  System   Design ',
        ai_level: 4,
        ai_confidence: 'high',
        competency_summary: 'Strong system design evidence.',
        evidence: ['quote'],
        assessor_override: nil
      )
    )
    vacancy = build_vacancy(VacancySkill.new(skill_id: nil, skill_label: 'system design', expected_level: 3))

    comparison = described_class.new(portfolio: portfolio, vacancy: vacancy).call.first

    expect(comparison[:result]).to eq('exceed')
    expect(comparison[:delta]).to eq(1)
  end

  it 'represents a required but unassessed skill as unknown instead of a gap' do
    portfolio = build_portfolio
    vacancy = build_vacancy(VacancySkill.new(skill_id: 'communication', skill_label: 'Communication', expected_level: 3))

    comparison = described_class.new(portfolio: portfolio, vacancy: vacancy).call.first

    expect(comparison).to include(
      candidate_level: nil,
      expected_level: 3,
      result: 'not_assessed',
      delta: nil,
      confidence: nil,
      overridden: false
    )
  end
end
