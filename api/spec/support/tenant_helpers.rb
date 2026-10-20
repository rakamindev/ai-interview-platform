# frozen_string_literal: true

# Tenant fixtures for isolation specs. Organizations live in the public schema
# and carry no app-level validations, so we build them directly.
module TenantHelpers
  def create_tenant(scheme:, name: nil)
    Organization.create!(
      name:       name || scheme.titleize,
      scheme:     scheme,
      identifier: scheme,
      host:       "#{scheme}.test"
    )
  end

  def create_assessment(tenant, name: 'Engineer')
    Assessment.create!(
      tenant_id:      tenant.id,
      created_by:     1,
      name:           name,
      time_limit_min: 30
    )
  end
end
