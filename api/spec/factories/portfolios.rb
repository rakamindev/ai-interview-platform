# frozen_string_literal: true

FactoryBot.define do
  factory :portfolio do
    association :session
    candidate_id { 9001 }
    generation_status { 'complete' }
    generated_at { Time.current }
    generation_error { nil }

    trait :pending do
      generation_status { 'pending' }
      generated_at { nil }
    end

    trait :generating do
      generation_status { 'generating' }
      generated_at { nil }
    end

    trait :failed do
      generation_status { 'failed' }
      generated_at { nil }
      generation_error { 'Gemini API timeout' }
    end

    trait :with_skills do
      after(:create) do |portfolio|
        create(:portfolio_skill, portfolio: portfolio, skill_label: 'React', skill_id: 'sk-1', ai_level: 3, ai_confidence: 'high')
        create(:portfolio_skill, portfolio: portfolio, skill_label: 'Ruby', skill_id: 'sk-2', ai_level: 2, ai_confidence: 'medium')
      end
    end
  end
end
