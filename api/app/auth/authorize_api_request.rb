# frozen_string_literal: true

require 'ostruct'

# Extracted and simplified from rakamin-api.
# Bearer token only (no basic auth — AI interview has no whitelist-key consumers).
# Resolves the signed-in user and tenant membership from persisted records.
class AuthorizeApiRequest
  # Roles that map to "assessor" permission in the AI interview context.
  # rakamin-api uses 'admin'; 'assessor' is planned as a future role.
  ASSESSOR_ROLES = %w[admin assessor].freeze

  def initialize(headers = {}, required_roles = [])
    @headers = headers
    @required_roles = Array(required_roles)
  end

  # Returns a user context and the authorized organization.
  def call
    claims = decoded_auth_token
    user, membership = resolve_membership!(claims)
    user_struct = build_user_struct(user, membership)

    check_role!(user_struct) if @required_roles.any?

    { user: user_struct, organization: membership.organization, claims: }
  end

  private

  attr_reader :headers

  def build_user_struct(user, membership)
    OpenStruct.new(
      id:     user.id,
      role:   membership.role,
      scheme: membership.organization.scheme
    )
  end

  def resolve_membership!(claims)
    user = User.find_by(id: claims[:user_id])
    raise(ExceptionHandler::Unauthorized, Message.unauthorized) unless user

    scheme = claims[:scheme].to_s
    requested_scheme = headers['X-Tenant-Scheme'].to_s
    if requested_scheme.present? && requested_scheme != scheme
      raise(ExceptionHandler::Unauthorized, 'Tenant selector does not match authenticated context')
    end

    organization = Organization.find_by(scheme:)
    membership = organization && TenantMembership.active.find_by(user_id: user.id, organization_id: organization.id)
    raise(ExceptionHandler::Unauthorized, 'Active tenant membership required') unless membership

    [user, membership]
  end

  def check_role!(user)
    allowed = @required_roles.map(&:to_s)

    # :any means no role restriction
    return if allowed.include?('any')

    effective_role = user.role
    if allowed.include?('assessor')
      return if ASSESSOR_ROLES.include?(effective_role)
    end

    return if allowed.include?(effective_role)

    raise(ExceptionHandler::Unauthorized, Message.unauthorized)
  end

  def decoded_auth_token
    JsonWebToken.decode(http_auth_header)
  rescue ExceptionHandler::InvalidToken => e
    raise(ExceptionHandler::InvalidToken, e.message)
  end

  def http_auth_header
    return headers['Authorization'].split(' ').last if headers['Authorization'].present?

    raise(ExceptionHandler::MissingToken, Message.missing_token)
  end
end
