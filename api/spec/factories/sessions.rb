# frozen_string_literal: true

FactoryBot.define do
  factory :session do
    tenant_id      { 1 }
    candidate_name { 'Budi Test' }
    status         { 'pending' }
    assessment     { association :assessment, tenant_id: tenant_id }

    # Interview is running: the candidate connected and the backend started the session.
    trait :active do
      status     { 'active' }
      started_at { 2.minutes.ago }
    end
  end
end
