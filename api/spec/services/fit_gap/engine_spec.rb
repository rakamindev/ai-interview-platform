# frozen_string_literal: true

require 'spec_helper'
require 'active_support'
require 'active_support/core_ext/enumerable'
require_relative '../../../app/services/fit_gap/engine'

# Plain stand-ins for the ActiveRecord objects, so no database is needed.
module EngineSpecFakes
  VacancySkill = Struct.new(:skill_label, :skill_id, :expected_level)
  PortfolioSkill = Struct.new(:id, :skill_id, :skill_label, :ai_level, :ai_confidence, :assessor_override)
  Override = Struct.new(:override_level)
  Vacancy = Struct.new(:vacancy_skills)
  Portfolio = Struct.new(:portfolio_skills)

  class Skills < Array
    def includes(*) = self
  end
end

RSpec.describe FitGap::Engine do
  include EngineSpecFakes

  def comparisons(vacancy_skills:, portfolio_skills:)
    engine = described_class.new(
      portfolio: EngineSpecFakes::Portfolio.new(EngineSpecFakes::Skills.new(portfolio_skills)),
      vacancy:   EngineSpecFakes::Vacancy.new(vacancy_skills),
      gemini_client: Object.new
    )
    engine.send(:build_skill_comparisons)
  end

  def vacancy_skill(label, expected)
    EngineSpecFakes::VacancySkill.new(label, nil, expected)
  end

  def portfolio_skill(label, level, override: nil, confidence: 'high')
    EngineSpecFakes::PortfolioSkill.new(1, nil, label, level, confidence, override)
  end

  it 'reports a skill missing from the portfolio as not_assessed, with no level' do
    result = comparisons(vacancy_skills: [vacancy_skill('RESTful API Design', 3)], portfolio_skills: []).first

    expect(result).to include(result: 'not_assessed', candidate_level: nil, expected_level: 3, delta: nil)
  end

  it 'reports match, gap and exceed against the expected level' do
    results = comparisons(
      vacancy_skills:   [vacancy_skill('React', 3), vacancy_skill('TypeScript', 3), vacancy_skill('Testing', 3)],
      portfolio_skills: [portfolio_skill('React', 3), portfolio_skill('TypeScript', 1), portfolio_skill('Testing', 5)]
    )

    expect(results.map { |r| [r[:result], r[:delta]] }).to eq([['match', 0], ['gap', -2], ['exceed', 2]])
  end

  it 'applies the assessor override and flags it with is_override' do
    override = EngineSpecFakes::Override.new(4)
    result = comparisons(
      vacancy_skills:   [vacancy_skill('React', 3)],
      portfolio_skills: [portfolio_skill('React', 1, override: override)]
    ).first

    expect(result).to include(candidate_level: 4, result: 'exceed', is_override: true)
  end

  it 'does not flag is_override when there is no override' do
    result = comparisons(
      vacancy_skills:   [vacancy_skill('React', 3)],
      portfolio_skills: [portfolio_skill('React', 3)]
    ).first

    expect(result[:is_override]).to be(false)
  end

  it 'matches vacancy and portfolio skills by label, ignoring case' do
    result = comparisons(
      vacancy_skills:   [vacancy_skill('typescript', 2)],
      portfolio_skills: [portfolio_skill('TypeScript', 2)]
    ).first

    expect(result[:result]).to eq('match')
  end
end
