# frozen_string_literal: true

FactoryBot.define do
  factory :session do
    transient do
      organization { association(:organization) }
    end

    assessment { association(:assessment, organization: organization) }
    tenant_id { organization.id }
    status { 'active' }
    sequence(:candidate_name) { |n| "Candidate #{n}" }
  end
end
