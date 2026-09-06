# frozen_string_literal: true

module RequestHelpers
  def json_body
    JSON.parse(response.body)
  end

  # Default tenant header mirrors the seeded 'test-corp' organization. Override
  # via `headers` to test other schemes.
  def post_signup(attrs = {}, headers = {})
    post '/api/v1/auth/signup', params: attrs, headers: tenant_headers.merge(headers)
  end

  def post_login(attrs = {}, headers = {})
    post '/api/v1/auth/login', params: attrs, headers: tenant_headers.merge(headers)
  end

  # Logs in and returns the raw JWT for use in an Authorization header.
  def login_get_token(email:, password:)
    post_login({ email:, password: })
    raise "login failed: #{json_body.inspect}" unless response.ok?

    json_body['token']
  end

  def auth_headers(token)
    { 'Authorization' => "Bearer #{token}" }
  end

  # Factory-created records in specs live outside an HTTP request, so give them
  # an explicit tenant context (TenantScoped assigns tenant_id on validate).
  def with_current_tenant(organization)
    Current.organization = organization
    Current.tenant_id    = organization.id
  end

  private

  def tenant_headers
    { 'X-Tenant-Scheme' => 'test-corp' }
  end
end

RSpec.configure do |config|
  config.include RequestHelpers, type: :request
end
