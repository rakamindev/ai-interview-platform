# frozen_string_literal: true

RSpec.configure do |config|
  config.after do
    Current.clear
  end
end

module TenantContextHelper
  def with_tenant(organization)
    Current.using(organization:, tenant_id: organization.id) { yield }
  end
end

RSpec.configure do |config|
  config.include TenantContextHelper
end
