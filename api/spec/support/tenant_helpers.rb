# frozen_string_literal: true

module TenantHelpers
  def setup_tenant(tenant_id = 1)
    RequestStore.store[:tenant_id] = tenant_id
    Current.tenant_id = tenant_id

    org = Organization.where(id: tenant_id).first ||
          Organization.create!(
            id: tenant_id,
            name: "Test Org #{tenant_id}",
            scheme: "test-tenant-#{tenant_id}",
            identifier: "test-tenant-#{tenant_id}",
            host: "test#{tenant_id}.example.com"
          )
    Current.organization = org
  end

  def clear_tenant
    RequestStore.clear!
    Current.clear
  end
end

RSpec.configure do |config|
  config.include TenantHelpers

  config.before(:each) do
    setup_tenant
  end

  config.after(:each) do
    clear_tenant
  end
end
