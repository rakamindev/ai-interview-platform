# frozen_string_literal: true

require "ostruct"

# Extracted and simplified from rakamin-api.
# Bearer token only (no basic auth — AI interview has no whitelist-key consumers).
# Returns { user_id:, role:, scheme: } from the decoded JWT, with role resolved
# from the DB membership row when a matching membership exists.
class AuthorizeApiRequest
  # Roles that map to "assessor" permission in the AI interview context.
  # 'admin' always qualifies; 'assessor' comes from the user's per-org
  # Membership.role (see #resolve_role_from_membership below) — User::ROLES
  # itself only has admin/user, since assessor is an org-scoped permission,
  # not an account-wide one.
  ASSESSOR_ROLES = %w[admin assessor].freeze

  def initialize(headers = {}, required_roles = [], cookies: {})
    @headers = headers
    @required_roles = Array(required_roles)
    @cookies = cookies
  end

  # Returns an OpenStruct with :id, :role, :scheme
  def call
    claims = decoded_auth_token
    user_struct = build_user_struct(claims)

    check_role!(user_struct) if @required_roles.any?

    { user: user_struct, claims: }
  end

  private

  attr_reader :headers, :cookies

  def build_user_struct(claims)
    user_id = claims[:user_id]
    scheme  = claims[:scheme].to_s

    role = resolve_role_from_membership(user_id, scheme) || claims[:role].to_s

    OpenStruct.new(
      id: user_id,
      role: role,
      scheme: scheme
    )
  end

  # Resolve the user's effective role from the memberships table for the
  # organization matching the JWT scheme claim. Falls back to the JWT role
  # claim when no membership row exists (backwards-compatible).
  def resolve_role_from_membership(user_id, scheme)
    return nil if scheme.blank?

    # TenantResolverMiddleware already resolved the org for this same scheme
    # earlier in the request — reuse it instead of a duplicate lookup. Not
    # every caller goes through that middleware (e.g. the WebSocket
    # middlewares call this directly), so Current.organization may be unset.
    cached_org = begin
      Current.organization
    rescue StandardError
      nil
    end
    org = (cached_org if cached_org&.scheme == scheme) || Organization.find_by(scheme: scheme)
    return nil unless org

    membership = Membership.find_by(user_id: user_id, organization_id: org.id)
    Current.membership = membership
    membership&.role
  end

  def check_role!(user)
    allowed = @required_roles.map(&:to_s)

    # :any means no role restriction
    return if allowed.include?("any")

    # Support logical grouping: :assessor_or_admin
    effective_role = user.role
    if allowed.include?("assessor") && ASSESSOR_ROLES.include?(effective_role)
      # Allow anyone whose role is in ASSESSOR_ROLES
      return
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
    return headers["Authorization"].split.last if headers["Authorization"].present?

    raise(ExceptionHandler::MissingToken, Message.missing_token)
  end
end
