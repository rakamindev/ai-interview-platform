# frozen_string_literal: true

FactoryBot.define do
  factory :organization, class: "Organization" do
    id { 0 }
    name { "Test Org" }
    scheme { "test-corp" }
    identifier { "test-corp" }
    host { "test.localhost" }
  end
end
