FactoryBot.define do
  factory :session do
    assessment
    tenant_id { assessment.tenant_id }
    status { "ended" }
    candidate_name { "Jane Candidate" }
  end
end
