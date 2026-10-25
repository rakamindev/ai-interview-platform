FactoryBot.define do
  factory :assessment do
    transient do
      organization { create(:organization) }
    end

    tenant_id      { organization.id }
    created_by     { 1 }
    name           { "Backend Engineer Assessment" }
    time_limit_min { 30 }
    language       { "en" }
  end
end
