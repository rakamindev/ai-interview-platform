FactoryBot.define do
  factory :portfolio do
    association :session
    generation_status { 'pending' }
  end
end
