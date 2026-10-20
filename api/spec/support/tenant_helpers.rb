# frozen_string_literal: true

require 'json_web_token'

module RequestHelpers
  def json_response
    JSON.parse(response.body)
  end
end

# Tenant resolution normally happens in middleware, which a spec never
# traverses. Specs that touch a TenantScoped model have to set that state
# themselves.
module TenantHelpers
  def in_tenant(organization = create(:organization))
    Current.organization = organization
    Current.tenant_id = organization.id
    organization
  end

  def auth_headers(user, organization)
    token = JsonWebToken.encode(
      user_id: user.id,
      role: user.role,
      scheme: organization.scheme
    )
    { 'Authorization' => "Bearer #{token}", 'X-Tenant-Scheme' => organization.scheme }
  end
end

RSpec.configure do |config|
  config.include RequestHelpers, type: :request
  config.include TenantHelpers, type: :request
  config.include TenantHelpers, type: :model
end
