FactoryBot.define do
  factory :transcript_turn do
    association :session
    sequence(:turn_number) { |n| n }
    speaker { 'candidate' }
    text { 'Sample transcript text' }
  end
end
