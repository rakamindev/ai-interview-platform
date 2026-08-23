require 'rails_helper'

RSpec.describe FitGap::Engine do
  let(:org)        { Organization.create!(name: 'Test', scheme: 'test', identifier: 'test', host: 'localhost') }
  let(:assessment) { Assessment.create!(tenant_id: org.id, created_by: 1, name: 'Fullstack', time_limit_min: 30) }
  let(:session)    { Session.create!(tenant_id: org.id, assessment: assessment, status: 'ended') }
  let(:portfolio)  { session.create_portfolio!(generation_status: 'complete') }
  let(:vacancy)    { Vacancy.create!(tenant_id: org.id, created_by: 1, role_title: 'Dev') }

  it 'reports a nil-level (not assessed) skill as not_assessed instead of crashing' do
    portfolio.portfolio_skills.create!(
      skill_id: 'sk-1', skill_label: 'React', is_discovered: false,
      ai_level: nil, ai_confidence: 'low', competency_summary: 'Never assessed.'
    )
    vacancy.vacancy_skills.create!(skill_label: 'React', expected_level: 3)

    comparisons = FitGap::Engine.new(portfolio: portfolio, vacancy: vacancy).send(:build_skill_comparisons)
    react = comparisons.find { |c| c[:skill_label] == 'React' }

    expect(react[:result]).to eq('not_assessed')
    expect(react[:candidate_level]).to be_nil
  end
end
