FactoryBot.define do
  factory :assessment do
    sequence(:name) { |n| "Assessment #{n}" }
    time_limit_min { 30 }
    created_by { 1 }
  end
end
