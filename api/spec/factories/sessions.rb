# frozen_string_literal: true

FactoryBot.define do
  factory :session do
    tenant_id { 1 }
    association :assessment
    invite_token { SecureRandom.hex(16) }
    status { "ended" }
    candidate_name { "John Doe" }
    candidate_email { "john.doe@example.com" }
  end

end
