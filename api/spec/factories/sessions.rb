# frozen_string_literal: true

FactoryBot.define do
  factory :session do
    tenant_id      { create(:organization).id }
    assessment
    candidate_id   { nil }
    candidate_name { Faker::Name.name }
    status         { 'pending' }
  end

  factory :consent do
    session
    tenant_id { session.tenant_id }
    version   { Consent::CURRENT_VERSION }
    status    { 'granted' }
    granted_at { Time.current }
  end
end