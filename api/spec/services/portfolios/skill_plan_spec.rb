# frozen_string_literal: true

require 'spec_helper'
require_relative '../../../app/services/portfolios/rating_normalizer'
require_relative '../../../app/services/portfolios/skill_plan'

RSpec.describe Portfolios::SkillPlan do
  it 'strips a markdown fence before parsing model output' do
    payload = described_class.parse_payload(<<~TEXT)
      ```json
      {"configured_skills":[{"skill_label":"SQL","level":2,"confidence":"high","evidence":["uses indexes"],"competency_summary":"Routine queries."}]}
      ```
    TEXT

    plan = described_class.build(payload)

    expect(plan.rows.map(&:skill_label)).to eq(['SQL'])
    expect(plan.omissions).to be_empty
  end

  it 'omits an invalid rating and keeps the valid sibling' do
    plan = described_class.build(
      'configured_skills' => [
        { 'skill_label' => 'SQL', 'level' => nil, 'confidence' => 'high', 'competency_summary' => 'n/a' },
        { 'skill_label' => 'React', 'skill_id' => 'sk-1', 'level' => 'L3', 'confidence' => 'medium', 'evidence' => ['', 'built the design system'], 'competency_summary' => '  Ships independently.  ' }
      ]
    )

    expect(plan.rows.map(&:skill_label)).to eq(['React'])
    expect(plan.rows.first.evidence).to eq(['built the design system'])
    expect(plan.rows.first.competency_summary).to eq('Ships independently.')
    expect(plan.omissions.map(&:reason)).to eq(['invalid_level'])
  end

  it 'omits a row that has no label' do
    plan = described_class.build('discovered_skills' => [{ 'skill_label' => '  ', 'level' => 2, 'confidence' => 'low' }])

    expect(plan.rows).to be_empty
    expect(plan.omissions.first.reason).to eq('missing_label')
  end
end
