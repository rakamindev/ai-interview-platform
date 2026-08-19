FactoryBot.define do
  factory :session do
    assessment
    candidate
    status { "pending" }
  end
end
