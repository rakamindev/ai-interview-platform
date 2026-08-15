# frozen_string_literal: true

FactoryBot.define do
  factory :portfolio do
    session           { association :session, :ended, tenant_id: Current.tenant_id }
    candidate_id      { nil }
    generation_status { 'complete' }
    generated_at      { Time.current }

    trait :pending do
      generation_status { 'pending' }
      generated_at      { nil }
    end

    trait :generating do
      generation_status { 'generating' }
      generated_at      { nil }
    end

    trait :failed do
      generation_status { 'failed' }
      generated_at      { nil }
      generation_error  { 'Gemini API timeout after 180s' }
    end

    trait :with_skills do
      transient { skill_count { 3 } }

      after(:create) do |portfolio, evaluator|
        evaluator.skill_count.times { create(:portfolio_skill, portfolio: portfolio) }
      end
    end
  end

  factory :portfolio_skill do
    portfolio
    sequence(:skill_id)    { |n| "sk-eng-#{format('%03d', n)}" }
    sequence(:skill_label) { |n| "Skill #{n}" }
    is_discovered          { false }
    ai_level               { 3 }
    ai_confidence          { 'high' }
    evidence               { ['We sharded the write path.', 'I would not do that again under load.'] }
    competency_summary     { 'Reasons about tradeoffs under production constraints.' }

    trait :low_confidence do
      ai_confidence { 'low' }
    end

    trait :discovered do
      is_discovered { true }
      skill_id      { nil }
    end

    trait :with_override do
      after(:create) do |skill|
        create(:assessor_override, portfolio_skill: skill, ai_level: skill.ai_level)
      end
    end
  end

  factory :assessor_override do
    portfolio_skill
    ai_level       { 2 }
    override_level { 4 }
    assessor_notes { 'Candidate demonstrated this clearly in the system design segment.' }
    overridden_by  { 1 }
    overridden_at  { Time.current }
  end
end
