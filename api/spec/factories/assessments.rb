# frozen_string_literal: true

FactoryBot.define do
  factory :assessment do
    sequence(:name) { |n| "Assessment #{n}" }
    time_limit_min { 30 }
    tenant_id      { 1 }
    created_by     { 1 }
    system_prompt  { 'You are an AI interviewer.' }
    language       { 'en' }
  end
end
