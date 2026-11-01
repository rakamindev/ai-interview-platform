FactoryBot.define do
  factory :session do
    assessment
    tenant_id { 1 }
    candidate_name { "Test Candidate" }
    status { "pending" }
  end
end
