# frozen_string_literal: true

FactoryBot.define do
  factory :session do
    assessment
    tenant_id { assessment.tenant_id }
    status { "ended" }
    end_reason { "all_covered" }

    trait :with_coverage do
      transient do
        covered_skill_labels { [] }
      end

      after(:create) do |session, evaluator|
        session.assessment.assessment_skills.each do |skill|
          state = evaluator.covered_skill_labels.include?(skill.skill_label) ? "covered" : "not_yet"
          create(:coverage_map, session:, skill_label: skill.skill_label, skill_id: skill.skill_id, state:)
        end
      end
    end
  end
end
