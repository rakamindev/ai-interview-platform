# frozen_string_literal: true

FactoryBot.define do
  factory :coverage_map do
    session
    sequence(:skill_label) { |n| "Skill #{n}" }
    is_discovered { false }
    state { 'covered' }
    probe_count { 3 }
  end
end
