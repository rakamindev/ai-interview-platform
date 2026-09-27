# frozen_string_literal: true

FactoryBot.define do
  factory :coverage_map do
    session
    sequence(:skill_id) { |n| "sk-#{n}" }
    skill_label { 'System Design' }
    is_discovered { false }
    state { 'not_yet' }
    probe_count { 0 }
    last_signal { nil }
  end
end
