# frozen_string_literal: true

FactoryBot.define do
  factory :portfolio do
    association :session
    generation_status { "complete" }
    generated_at { Time.current }
  end

  factory :portfolio_skill do
    association :portfolio
    skill_id { "SK-ENG-001" }
    skill_label { "React / Frontend Development" }
    is_discovered { false }
    ai_level { 3 }
    ai_confidence { "high" }
    evidence { ["Quote 1 showing React knowledge"] }
    competency_summary { "Demonstrated strong knowledge of component lifecycles and state." }
  end
end
