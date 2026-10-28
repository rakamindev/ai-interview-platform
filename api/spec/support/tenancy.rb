# frozen_string_literal: true

# Tenant context and auth helpers for specs.
#
# Request specs go through TenantResolverMiddleware like real traffic, so the tenant comes from
# the JWT `scheme` claim. Model and service specs set the tenant directly with `with_tenant`.
module TenancyHelpers
  def with_tenant(organization, &block)
    Current.using(organization: organization, tenant_id: organization.id, &block)
  end

  def auth_headers_for(organization, role: 'admin', user_id: 1)
    token = JsonWebToken.encode({ user_id: user_id, role: role, scheme: organization.scheme })
    { 'Authorization' => "Bearer #{token}" }
  end
end

RSpec.configure do |config|
  config.include TenancyHelpers

  # Never let tenant context leak from one example into the next.
  config.after { RequestStore.clear! }
end

RSpec.configure do |config|
  config.include FactoryBot::Syntax::Methods
end
