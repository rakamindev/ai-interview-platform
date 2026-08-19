# frozen_string_literal: true

FactoryBot.define do
  factory :session do
    transient do
      organization { create(:organization) }
    end

    assessment { create(:assessment, organization:) }
    candidate_name { "Test Candidate" }
    invite_token { SecureRandom.hex(32) }
    status { "pending" }
    tenant_id { organization.id }
  end
end