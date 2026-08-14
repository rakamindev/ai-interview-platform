# frozen_string_literal: true

module TenantHelpers
  def with_tenant(tenant_id, &block)
    Current.using(tenant_id: tenant_id, &block)
  end
end

RSpec.configure do |config|
  config.include TenantHelpers

  config.after(:each) { RequestStore.clear! }
end
