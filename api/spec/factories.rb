# frozen_string_literal: true

# Minimal factories for the failure-handling slice. tenant_id is set explicitly so
# specs don't depend on request-time tenant resolution (Current.tenant_id).
FactoryBot.define do
  factory :organization do
    sequence(:name)       { |n| "Org #{n}" }
    sequence(:scheme)     { |n| "org-#{n}" }
    sequence(:identifier) { |n| "org-#{n}" }
    sequence(:host)       { |n| "org-#{n}.example.test" }
  end

  factory :assessment do
    transient { organization { create(:organization) } }

    tenant_id      { organization.id }
    created_by     { 1 }
    name           { 'Backend Engineering Assessment' }
    time_limit_min { 45 }
    language       { 'en' }
  end

  factory :session do
    association :assessment
    tenant_id { assessment.tenant_id }
    status    { 'pending' }
  end

  factory :transcript_turn do
    association :session
    sequence(:turn_number) { |n| n }
    speaker { 'candidate' }
    text    { 'The candidate described how they built the payroll system.' }
  end
end
