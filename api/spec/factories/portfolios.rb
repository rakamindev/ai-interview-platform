# frozen_string_literal: true

FactoryBot.define do
  factory :portfolio do
    association :session
    generation_status { "complete" }
    generated_at      { Time.current }
  end

  factory :portfolio_skill do
    association :portfolio
    sequence(:skill_id)    { |n| "SK-ENG-#{n.to_s.rjust(3, '0')}" }
    sequence(:skill_label) { |n| "Skill #{n}" }
    is_discovered      { false }
    ai_level           { 3 }
    ai_confidence      { "high" }
    evidence           { ["Evidence quote one.", "Evidence quote two."] }
    competency_summary { "Candidate demonstrates solid competency." }
  end

  factory :assessor_override do
    association :portfolio_skill
    ai_level       { 3 }
    override_level { 4 }
    assessor_notes { "Observed stronger performance in follow-up." }
    overridden_by  { 1 }
    overridden_at  { Time.current }
  end
end
