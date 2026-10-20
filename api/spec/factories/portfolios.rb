# frozen_string_literal: true

FactoryBot.define do
  factory :portfolio do
    session
    generation_status { 'pending' }

    trait :complete do
      generation_status { 'complete' }
      generated_at { Time.current }
    end

    trait :failed do
      generation_status { 'failed' }
      generation_error { 'API returned 503' }
    end

    trait :generating do
      generation_status { 'generating' }
    end
  end

  factory :portfolio_skill do
    portfolio
    sequence(:skill_label) { |n| "Skill #{n}" }
    ai_level { 3 }
    ai_confidence { 'high' }
    evidence { ['We cut re-renders by 60% by splitting providers.'] }
    competency_summary { 'Handles complex state work with clear reasoning.' }
    is_discovered { false }

    trait :low_confidence do
      ai_confidence { 'low' }
    end

    trait :discovered do
      is_discovered { true }
    end
  end

  factory :assessor_override do
    portfolio_skill
    ai_level { 3 }
    override_level { 4 }
    assessor_notes { 'Deeper than the transcript alone shows.' }
    overridden_by { create(:user).id }
  end
end