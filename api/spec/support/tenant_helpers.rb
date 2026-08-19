# frozen_string_literal: true

# Provides a Current-based tenant context for specs. Assessment/Vacancy/Session
# use the TenantScoped concern which filters on RequestStore.store[:tenant_id],
# so we must set it before creating records and reading them back.
module TenantHelpers
  def with_tenant(org)
    old = RequestStore.store[:tenant_id]
    RequestStore.store[:tenant_id] = org.id
    yield
  ensure
    RequestStore.store[:tenant_id] = old
  end
end

RSpec.configure do |config|
  config.include TenantHelpers
end
