# frozen_string_literal: true

# Extracted and adapted from rakamin-api.
#
# Resolves the current tenant (Organization) per request and sets:
#   Current.organization  → the Organization AR record
#   Current.tenant_id     → organization.id (used to scope all AI interview queries)
#
# Resolution order:
#   Bearer requests: use only the JWT `scheme` hint; authorization later verifies the signature
#   and binds the signed tenant to the resolved organization. No header/Referer fallback.
#   Non-Bearer requests: X-Tenant-Scheme, then Referer host (existing unauthenticated flows).
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
    return scheme_from_jwt(request) if bearer_auth?(request)

    request.headers['X-Tenant-Scheme'].presence || scheme_from_referer(request)
  end

  def bearer_auth?(request)
    request.headers['Authorization'].to_s.match?(/\ABearer(?:\s|$)/i)
  end

  def scheme_from_jwt(request)
    auth_header = request.headers['Authorization'].to_s
    return unless bearer_auth?(request)

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
