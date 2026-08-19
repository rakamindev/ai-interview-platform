# frozen_string_literal: true

# Extracted and adapted from rakamin-api.
#
# Resolves the current tenant (Organization) per request and sets:
#   Current.organization  → the Organization AR record
#   Current.tenant_id     → organization.id (used to scope all AI interview queries)
#
# Resolution:
#   Tenant is resolved ONLY from a cryptographically verified JWT `scheme` claim
#   (SEC-2). The spoofable X-Tenant-Scheme header and referer fallbacks were removed;
#   candidate and WebSocket flows resolve tenant from the session (invite token).
#
# If no tenant can be resolved, the request continues with no tenant set.
# Controllers enforce tenant presence via require_tenant!.
class TenantResolverMiddleware < ApplicationMiddleware
  def call(env)
    request = ActionDispatch::Request.new(env)

    scheme = resolve_scheme(request)
    organization = find_organization(scheme)

    if organization
      Current.organization = organization
      Current.tenant_id    = organization.id
    end

    super
  end

  private

  # Tenant comes ONLY from a verified JWT scheme claim.
  def resolve_scheme(request)
    auth_header = request.headers['Authorization'].to_s
    return unless auth_header.start_with?('Bearer ', 'bearer ')

    token = auth_header.split(' ').last
    JsonWebToken.decode(token)[:scheme].presence
  rescue StandardError
    nil
  end

  def find_organization(scheme)
    return if scheme.blank?

    Organization.identify(scheme)
  rescue StandardError
    nil
  end
end
