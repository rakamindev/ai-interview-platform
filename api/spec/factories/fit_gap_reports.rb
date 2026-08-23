# frozen_string_literal: true

FactoryBot.define do
  factory :fit_gap_report do
    association :portfolio
    association :vacancy, strategy: :create
    tenant_id { portfolio.tenant_id }
    # FitGapReport validates presence of skill_comparisons — [] is blank?
    # true for an Array, so an empty default fails that validation.
    skill_comparisons { [{ "skill_label" => "Test Skill", "result" => "match" }] }
    culture_narrative { "A test culture narrative." }
    overall_narrative { "A test overall narrative." }
  end
end
