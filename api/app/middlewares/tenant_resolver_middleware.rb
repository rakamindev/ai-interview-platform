# frozen_string_literal: true

class TenantResolverMiddleware < ApplicationMiddleware
  def call(env)
    request = ActionDispatch::Request.new(env)

    scheme = scheme_from_jwt(request)
    organization = find_organization(scheme)

    if organization
      Current.organization = organization
      Current.tenant_id    = organization.id
    end

    super
  end

  private

  def scheme_from_jwt(request)
    token = bearer_token(request)
    return if token.blank?

    claims = JsonWebToken.decode(token)
    claims[:scheme].presence
  rescue StandardError
    nil
  end

  def bearer_token(request)
    auth_header = request.headers['Authorization'].to_s
    return auth_header.split(' ').last if auth_header.start_with?('Bearer ', 'bearer ')

    request.cookies['auth_token'].presence
  end

  def find_organization(scheme)
    return if scheme.blank?

    Organization.identify(scheme)
  rescue StandardError
    nil
  end
end
