FactoryBot.define do
  factory :session do
    transient do
      organization { create(:organization) }
    end

    assessment     { create(:assessment, organization: organization) }
    tenant_id      { organization.id }
    candidate_name { "Jane Candidate" }
    status         { "ended" }
    end_reason     { "all_covered" }
  end
end
