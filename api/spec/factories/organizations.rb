# frozen_string_literal: true

# `organizations` lives in the public schema because it is shared with
# rakamin-api. id 0 is the "default" tenant that Organization.identify falls back
# to, so real tenants start at 1.
FactoryBot.define do
  factory :organization do
    sequence(:name) { |n| "Org #{n}" }
    sequence(:scheme) { |n| "org-#{n}" }
    sequence(:identifier) { |n| "org-#{n}" }
    sequence(:host) { |n| "org-#{n}.test" }
    alias_hosts { [] }
    config { {} }

    trait :default do
      id { 0 }
      name { 'Default' }
      scheme { 'default' }
      identifier { 'default' }
      host { 'default.test' }
    end
  end
end