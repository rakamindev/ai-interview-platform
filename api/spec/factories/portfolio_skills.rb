# frozen_string_literal: true

FactoryBot.define do
  factory :portfolio_skill do
    portfolio
    sequence(:skill_label) { |n| "Skill #{n}" }
    ai_level { 3 }
    ai_confidence { 'medium' }
    competency_summary { 'Applies the skill independently on real projects.' }
    evidence { ['Built and shipped a production feature using this skill.'] }
  end
end
