FactoryBot.define do
  factory :vacancy do
    tenant_id { 1 }
    created_by { 1 }
    sequence(:role_title) { |n| "Role #{n}" }
  end
end
