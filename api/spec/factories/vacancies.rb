# frozen_string_literal: true

FactoryBot.define do
  factory :vacancy do
    sequence(:role_title) { |n| "Backend Engineer #{n}" }
    culture_dimensions { 'Collaborative, proactive problem-solver' }
    competency_expectations { 'Clean architecture and modular testing' }
    created_by { 1 }
    tenant_id { Current.tenant_id || 1 }
  end

  factory :vacancy_skill do
    association :vacancy
    sequence(:skill_id) { |n| "SKILL_#{n}" }
    sequence(:skill_label) { |n| "Skill #{n}" }
    expected_level { 3 }
  end
end
