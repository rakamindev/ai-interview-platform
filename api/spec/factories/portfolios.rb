FactoryBot.define do
  factory :portfolio do
    association :session
    generation_status { "complete" }
    generated_at      { Time.current }
  end
end
