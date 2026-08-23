# frozen_string_literal: true

FactoryBot.define do
  factory :coverage_map do
    association :session
    skill_id { nil }
    sequence(:skill_label) { |n| "Coverage Skill #{n}" }
    is_discovered { false }
    state { 'not_yet' }
    probe_count { 0 }
    last_signal { nil }

    trait :configured do
      is_discovered { false }
    end

    trait :discovered do
      is_discovered { true }
      skill_id { nil }
    end

    trait :initiated do
      state { 'initiated' }
      probe_count { 1 }
    end

    trait :partial do
      state { 'partial' }
      probe_count { 3 }
    end

    trait :covered do
      state { 'covered' }
      probe_count { 5 }
      last_signal { 'Sufficient evidence gathered' }
    end
  end
end
