FactoryBot.define do
  factory :vacancy do
    sequence(:role_title) { |n| "Backend Engineer #{n}" }
    created_by { 1 }
  end
end
