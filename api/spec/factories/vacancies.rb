# frozen_string_literal: true

FactoryBot.define do
  factory :vacancy do
    tenant_id               { Current.tenant_id }
    created_by              { 1 }
    sequence(:role_title)   { |n| "Senior Backend Engineer #{n}" }
    culture_dimensions      { 'Writes things down. Disagrees early rather than late.' }
    competency_expectations { 'Owns a service end to end, including its failure modes.' }

    trait :with_skills do
      transient { skill_count { 3 } }

      after(:create) do |vacancy, evaluator|
        evaluator.skill_count.times { create(:vacancy_skill, vacancy: vacancy) }
      end
    end
  end

  factory :vacancy_skill do
    vacancy
    sequence(:skill_id)    { |n| "sk-eng-#{format('%03d', n)}" }
    sequence(:skill_label) { |n| "Skill #{n}" }
    expected_level         { 3 }
  end

  factory :fit_gap_report do
    portfolio
    vacancy
    skill_comparisons { [] }
    culture_narrative { 'Communicates tradeoffs plainly.' }
    overall_narrative { 'Strong fit with one addressable gap.' }
    generated_at      { Time.current }
  end
end
