# frozen_string_literal: true

FactoryBot.define do
  factory :vacancy do
    # Must match the tenant the request specs resolve to (the seeded test-corp org),
    # otherwise Vacancy's TenantScoped default_scope filters the row out.
    tenant_id { Organization.find_by(scheme: "test-corp")&.id || 1 }
    created_by { 1 }
    role_title { "Engineer #{SecureRandom.hex(3)}" }
  end
end
