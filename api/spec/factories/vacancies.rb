# frozen_string_literal: true

FactoryBot.define do
  factory :vacancy do
    tenant_id { create(:organization).id }
    created_by { create(:user).id }
    sequence(:role_title) { |n| "Senior Engineer #{n}" }

    trait :with_skills do
      after(:create) do |vacancy, evaluator|
        create_list(:vacancy_skill, evaluator.skill_count, vacancy: vacancy)
      end
    end

    transient do
      skill_count { 2 }
    end
  end

  factory :vacancy_skill do
    vacancy
    sequence(:skill_label) { |n| "Required Skill #{n}" }
    expected_level { 3 }
  end

  factory :fit_gap_report do
    portfolio
    vacancy
    # skill_comparisons is required and an empty array is blank, so the
    # previous `[]` default made this factory unusable — every build raised
    # RecordInvalid before reaching anything worth testing. Shaped after
    # FitGap::Engine#build_skill_comparisons.
    skill_comparisons do
      [
        {
          'skill_label'     => 'Systems thinking',
          'skill_id'        => 'sys-thinking',
          'candidate_level' => 3,
          'expected_level'  => 4,
          'result'          => 'gap',
          'delta'           => -1,
          'confidence'      => 'high'
        }
      ]
    end
    # Non-empty as well: specs assert a narrative is absent from a response
    # body, and `include('')` is always true.
    culture_narrative { 'Asks for context when blocked rather than guessing.' }
    overall_narrative { 'Owns the whole problem and explains trade-offs plainly.' }
    generated_at      { Time.current }
  end
end