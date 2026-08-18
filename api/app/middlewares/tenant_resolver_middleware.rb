# frozen_string_literal: true

# Extracted and adapted from rakamin-api.
#
# Resolves the current tenant (Organization) per request and sets:
#   Current.organization  → the Organization AR record
#   Current.tenant_id     → organization.id (used to scope all AI interview queries)
#
# Resolution order:
#   1. JWT Bearer token → decode → use `scheme` claim
#   2. X-Tenant-Scheme request header (for non-JWT requests / candidate flows)
#   3. Referer host (fallback, same as rakamin-api HostService approach)
#
# If no tenant can be resolved, the request continues with no tenant set.
# Individual controllers can enforce tenant presence via before_action.
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

  def resolve_scheme(request)
    # 1. Try JWT bearer token first
    scheme_from_jwt(request) ||
      # 2. Try explicit header
      request.headers['X-Tenant-Scheme'].presence ||
      # 3. Fall back to referer host
      scheme_from_referer(request)
  end

  def scheme_from_jwt(request)
    auth_header = request.headers['Authorization'].to_s
    return unless auth_header.start_with?('Bearer ', 'bearer ')

    token = auth_header.split(' ').last
    claims = JsonWebToken.decode_without_verification(token)
    claims[:scheme].presence
  rescue StandardError
    nil
  end

  def scheme_from_referer(request)
    referer = request.referer.to_s
    return if referer.blank?

    host = URI.parse(referer).host.to_s
    host.presence
  rescue URI::InvalidURIError
    nil
  end

  def find_organization(scheme)
    return if scheme.blank?

    Organization.identify(scheme)
  rescue StandardError
    nil
  end
end
