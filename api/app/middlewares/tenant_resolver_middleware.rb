# frozen_string_literal: true

# Extracted and adapted from rakamin-api.
#
# Resolves the current tenant (Organization) per request and sets:
#   Current.organization  → the Organization AR record
#   Current.tenant_id     → organization.id (used to scope all AI interview queries)
#
# The middleware provides a provisional tenant for candidate-token routes.
# Authenticated REST actions replace it only after membership verification.
# Individual controllers can enforce tenant presence via before_action.
class TenantResolverMiddleware < ApplicationMiddleware
  def call(env)
    request = ActionDispatch::Request.new(env)

    scheme = scheme_from_jwt(request) || request.headers['X-Tenant-Scheme'].presence
    organization = scheme.present? ? Organization.find_by(scheme:) : nil

    if organization
      Current.organization = organization
      Current.tenant_id    = organization.id
    end

    super
  end

  private

  def resolve_scheme(request)
    scheme_from_jwt(request) || request.headers['X-Tenant-Scheme'].presence
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

end
