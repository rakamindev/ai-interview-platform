# frozen_string_literal: true

FactoryBot.define do
  factory :assessment do
    tenant_id     { create(:organization).id }
    created_by    { 1 }
    name          { Faker::Job.title }
    time_limit_min { 45 }
    language      { 'en' }
  end
end