# frozen_string_literal: true

FactoryBot.define do
  factory :session do
    association :assessment
    sequence(:invite_token) { |n| "token-#{n}" }
    status    { "pending" }
    tenant_id { 1 }
  end

  factory :transcript_turn do
    association :session
    sequence(:turn_number) { |n| n }
    speaker { "candidate" }
    sequence(:text) { |n| "Turn #{n} content." }
  end

  factory :coverage_map do
    association :session
    sequence(:skill_label) { |n| "Skill #{n}" }
    sequence(:skill_id)    { |n| "SK-ENG-#{n.to_s.rjust(3, '0')}" }
    is_discovered { false }
    state         { "covered" }
    probe_count   { 3 }
  end
end
