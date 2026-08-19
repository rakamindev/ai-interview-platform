FactoryBot.define do
  factory :candidate do
    sequence(:email) { |n| "candidate#{n}@example.com" }
    name { "Jane Candidate" }
  end
end
