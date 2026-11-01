FactoryBot.define do
  factory :vacancy do
    tenant_id { 1 }
    created_by { 1 }
    role_title { "Senior Frontend Engineer" }
  end

  factory :vacancy_skill do
    vacancy
    skill_id { "SK-ENG-001" }
    skill_label { "React / Frontend Development Core" }
    expected_level { 3 }
  end
end
