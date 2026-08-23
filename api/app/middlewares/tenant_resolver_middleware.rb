# frozen_string_literal: true

# Extracted and adapted from rakamin-api.
#
# Resolves the current tenant (Organization) per request and sets:
#   Current.organization  → the Organization AR record
#   Current.tenant_id     → organization.id (used to scope all AI interview queries)
#
# Resolution order:
#   With a Bearer token: the `scheme` claim of the VERIFIED token only.
#     (Header/referer are client-controlled and must never override it.)
#   Without credentials:
#   1. X-Tenant-Scheme request header (non-JWT flows, e.g. login)
#   2. Referer host (fallback, same as rakamin-api HostService approach)
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
    if bearer_token(request)
      # A Bearer token is authoritative: only its VERIFIED claims may pick the
      # tenant. Header/referer fallbacks are client-controlled and would let an
      # authenticated user (or a token without a scheme claim) target any tenant.
      scheme_from_verified_jwt(request)
    else
      # No credentials at all: legacy fallbacks for non-JWT flows.
      request.headers['X-Tenant-Scheme'].presence || scheme_from_referer(request)
    end
  end

  def bearer_token(request)
    auth_header = request.headers['Authorization'].to_s
    auth_header.match(/\ABearer\s+(\S+)\z/i)&.[](1)
  end

  def scheme_from_verified_jwt(request)
    claims = JsonWebToken.decode(bearer_token(request))
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
