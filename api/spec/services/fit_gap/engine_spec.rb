# frozen_string_literal: true

require_relative '../../spec_helper'

class FitGapReport
end unless defined?(FitGapReport)

require_relative '../../../app/services/fit_gap/engine'

RSpec.describe FitGap::Engine do
  Skill = Struct.new(:skill_id, :skill_label, :expected_level)

  it 'keeps unassessed items out of gap scoring and emits aligned API fields' do
    expected = Skill.new('SK-A', 'Architecture', 4)
    portfolio = double(portfolio_skills: double(includes: [double(
      id: 12, skill_id: 'SK-A', skill_label: 'Architecture', ai_level: 3, ai_confidence: 'medium',
      assessment_status: 'assessed', assessor_override: double(override_level: 3)
    )]))
    vacancy = double(vacancy_skills: [expected])
    engine = described_class.allocate
    engine.instance_variable_set(:@portfolio, portfolio)
    engine.instance_variable_set(:@vacancy, vacancy)

    result = engine.send(:build_skill_comparisons).first

    expect(result).to include(expected_level: 4, result: 'gap', is_override: true)
    expect(result).not_to have_key(:required_level)
  end

  it 'does not compare a skill without an assessed level' do
    expected = Skill.new('SK-A', 'Architecture', 4)
    skill = double(id: 13, skill_id: 'SK-A', skill_label: 'Architecture', ai_level: nil,
                   ai_confidence: nil, assessment_status: 'not_assessed', assessor_override: nil)
    portfolio = double(portfolio_skills: double(includes: [skill]))
    vacancy = double(vacancy_skills: [expected])
    engine = described_class.allocate
    engine.instance_variable_set(:@portfolio, portfolio)
    engine.instance_variable_set(:@vacancy, vacancy)

    result = engine.send(:build_skill_comparisons).first

    expect(result).to include(expected_level: 4, candidate_level: nil, result: 'not_assessed', delta: nil, is_override: false)
  end
end
