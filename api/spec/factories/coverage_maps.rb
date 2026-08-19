# frozen_string_literal: true

FactoryBot.define do
  factory :coverage_map do
    association :session
    skill_id { 'sk-1' }
    skill_label { 'React' }
    is_discovered { false }
    state { 'not_yet' }
    probe_count { 0 }
    last_signal { nil }

    trait :initiated do
      state { 'initiated' }
      probe_count { 1 }
    end

    trait :partial do
      state { 'partial' }
      probe_count { 2 }
    end

    trait :covered do
      state { 'covered' }
      probe_count { 3 }
      last_signal { 'Strong evidence of React proficiency' }
    end

    trait :discovered do
      is_discovered { true }
      skill_id { nil }
      skill_label { 'Micro-frontend' }
      state { 'initiated' }
      probe_count { 1 }
    end
  end
end
