# frozen_string_literal: true

FactoryBot.define do
  factory :portfolio_skill do
    portfolio
    skill_label { "React / Frontend Development Core" }
    ai_level { 3 }
    ai_confidence { "high" }
    competency_summary { "Test competency summary." }
  end
end