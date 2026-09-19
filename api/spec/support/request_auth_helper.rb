# frozen_string_literal: true

# Helpers for request specs: authenticates as a rakamin 'admin' (which maps to
# the assessor role) and lets the TenantResolverMiddleware resolve a tenant from
# the X-Tenant-Scheme header without hitting a real JWT.
module RequestAuthHelper
  def json_response_body
    JSON.parse(response.body)
  end

  # Runs a request-spec body with an authorized assessor and a resolvable tenant.
  # The app's TenantResolverMiddleware resolves from X-Tenant-Scheme (no real JWT),
  # and AuthorizeApiRequest is stubbed to avoid crypto/DB lookups.
  def with_authorized_request
    allow(AuthorizeApiRequest).to receive(:new) do
      double(call: { user: OpenStruct.new(id: 1, role: 'admin', scheme: 'test-scheme') })
    end
    yield
  end

  def authenticated_get(path, **kwargs)
    get path, headers: auth_headers, **kwargs
  end

  def authenticated_post(path, **kwargs)
    post path, headers: auth_headers, **kwargs
  end

  private

  def auth_headers
    {
      "HTTP_AUTHORIZATION"  => "Bearer test-token",
      "HTTP_X_TENANT_SCHEME" => "test-scheme"
    }
  end
end