# frozen_string_literal: true

FactoryBot.define do
  factory :coverage_map do
    association :session
    skill_id { 'backend-ruby' }
    skill_label { 'Ruby' }
    is_discovered { false }
    state { 'not_yet' }
    probe_count { 0 }
  end
end
