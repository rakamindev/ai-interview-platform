# frozen_string_literal: true

FactoryBot.define do
  factory :coverage_map do
    association :session
    skill_id { 'SK-TEST-001' }
    sequence(:skill_label) { |n| "Test Skill #{n}" }
    state { 'covered' }
    probe_count { 3 }
    is_discovered { false }
  end
end
