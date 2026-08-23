# frozen_string_literal: true

module RequestHelpers
  def json_response
    JSON.parse(response.body, symbolize_names: true)
  end

  # Generates auth headers using the app's own JsonWebToken encoder
  # so the token can be verified by AuthorizeApiRequest.
  def auth_headers(user_id: 1, role: 'admin', scheme: 'test-scheme')
    token = JsonWebToken.encode(
      user_id: user_id,
      role:    role,
      scheme:  scheme
    )
    {
      'Authorization' => "Bearer #{token}",
      'Content-Type'  => 'application/json',
      'Accept'        => 'application/json'
    }
  end

  def json_headers
    {
      'Content-Type' => 'application/json',
      'Accept'       => 'application/json'
    }
  end

  # Sets up RequestStore with tenant context for integration tests.
  # Must be called before making requests to tenant-scoped controllers.
  def set_tenant_context!(organization)
    RequestStore.store[:organization] = organization
    RequestStore.store[:tenant_id]    = organization.id
  end
end

RSpec.configure do |config|
  config.include RequestHelpers, type: :request
  config.include RequestHelpers, type: :controller
end
