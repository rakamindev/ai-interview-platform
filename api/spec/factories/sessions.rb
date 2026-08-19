FactoryBot.define do
  factory :session do
    tenant_id { 1 }
    assessment
    candidate_name { 'Test Candidate' }
    status { 'pending' }
  end
end
