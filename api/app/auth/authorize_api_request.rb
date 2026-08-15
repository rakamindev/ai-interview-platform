# frozen_string_literal: true

# Extracted and simplified from rakamin-api.
# Bearer token only (no basic auth — AI interview has no whitelist-key consumers).
# Returns { user_id:, role:, scheme: } from the decoded JWT.
# Does NOT hit the database for user lookup — trusts the JWT claims.
class AuthorizeApiRequest
  # Roles that map to "assessor" permission in the AI interview context.
  # rakamin-api uses 'admin'; 'assessor' is planned as a future role.
  ASSESSOR_ROLES = %w[admin assessor].freeze

  def initialize(headers = {}, required_roles = [])
    @headers = headers
    @required_roles = Array(required_roles)
  end

  def call
    claims = decoded_auth_token
    user   = load_active_user!(claims)

    check_role!(user) if @required_roles.any?

    { user:, claims: }
  end

  private

  attr_reader :headers

  def load_active_user!(claims)
    user = User.find_by(id: claims[:user_id])

    raise(ExceptionHandler::InvalidToken, 'User no longer exists') if user.nil?
    raise(ExceptionHandler::InvalidToken, 'User account is inactive') unless user.active?

    user
  end

  def check_role!(user)
    allowed = @required_roles.map(&:to_s)

    # :any means no role restriction
    return if allowed.include?('any')

    # Support logical grouping: :assessor_or_admin
    effective_role = user.role
    if allowed.include?('assessor')
      # Allow anyone whose role is in ASSESSOR_ROLES
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
