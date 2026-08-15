# frozen_string_literal: true

require 'ostruct'

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

  # Returns an OpenStruct with :id, :role, :scheme
  def call
    claims = decoded_auth_token
    user_struct = build_user_struct(claims)

    check_role!(user_struct) if @required_roles.any?
    raise(ExceptionHandler::Unauthorized, Message.unauthorized) unless account_active?(user_struct)

    { user: user_struct, claims: }
  end

  private

  attr_reader :headers

  # Only locally-issued admin tokens can be checked against this app's own
  # `users` table — 'assessor' tokens are minted by the sister rakamin-api app
  # for accounts that don't exist here at all, so there's nothing local to
  # check them against yet (see assessment/gap-analysis.md Constraint Signal).
  # Cached briefly so a deactivation still applies without a DB hit on every
  # single authenticated request — the JWT itself is still what's trusted for
  # everything else per-request; this only gates the rare "has this specific
  # account been shut off" case.
  def account_active?(user)
    return true unless user.role == 'admin'

    Rails.cache.fetch("auth/user_active/#{user.id}", expires_in: 60.seconds) do
      User.where(id: user.id, active: true).exists?
    end
  end

  def build_user_struct(claims)
    OpenStruct.new(
      id:     claims[:user_id],
      role:   claims[:role].to_s,
      scheme: claims[:scheme].to_s
    )
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
