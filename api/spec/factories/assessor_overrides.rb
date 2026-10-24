# frozen_string_literal: true

FactoryBot.define do
  factory :assessor_override do
    portfolio_skill
    ai_level { portfolio_skill.ai_level }
    override_level { 4 }
    overridden_by { create(:user).id }
  end
end
