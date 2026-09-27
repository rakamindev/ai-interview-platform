# frozen_string_literal: true

FactoryBot.define do
  factory :portfolio do
    session
    generation_status { 'complete' }
    generated_at { Time.current }
  end

  factory :portfolio_skill do
    portfolio
    sequence(:skill_id) { |n| "sk-#{n}" }
    skill_label { 'React Framework' }
    ai_level { 3 }
    ai_confidence { 'high' }
    evidence { ['I used React hooks and context for state management.'] }
    competency_summary { 'Demonstrates strong understanding of component lifecycle.' }
  end

  factory :fit_gap_report do
    portfolio
    vacancy
    skill_comparisons { [{ skill_label: 'React Framework', result: 'match', candidate_level: 3, expected_level: 3 }] }
    culture_narrative { 'Good cultural alignment.' }
    overall_narrative { 'Solid engineering candidate.' }
  end
end
