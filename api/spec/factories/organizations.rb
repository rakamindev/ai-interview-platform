# frozen_string_literal: true

FactoryBot.define do
  # A tenant. Lives in public.organizations; tokens reference it by `scheme`.
  factory :organization do
    sequence(:name)   { |n| "Contoh Org #{n}" }
    sequence(:scheme) { |n| "contoh-org-#{n}" }
    identifier { scheme }
    host       { "#{scheme}.invalid" }
  end
end
