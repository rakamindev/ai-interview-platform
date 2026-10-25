FactoryBot.define do
  factory :session do
    assessment
    tenant_id { 1 }
    status { 'pending' }
    candidate_name { 'John Doe' }
    candidate_id { 1 }

    after(:build) do |session|
      Current.tenant_id = session.tenant_id || 1
    end
  end
end
