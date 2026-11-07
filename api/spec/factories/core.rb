# frozen_string_literal: true

# Fictional test data only — no real personal data (UU PDP).
FactoryBot.define do
  factory :organization do
    sequence(:name)   { |n| "Test Org #{n}" }
    sequence(:scheme) { |n| "test-org-#{n}" }
    identifier { scheme }
    host       { "#{scheme}.example.test" }
  end

  factory :assessment do
    transient do
      organization { association(:organization) }
    end

    tenant_id      { organization.id }
    created_by     { 1 }
    name           { 'Project Manager' }
    time_limit_min { 10 }
    language       { 'en' }
  end

  factory :session do
    assessment
    tenant_id      { assessment.tenant_id }
    candidate_name { 'Kandidat Uji' }
  end
end
