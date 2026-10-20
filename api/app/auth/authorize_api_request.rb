# frozen_string_literal: true

require 'ostruct'

# Extracted and simplified from rakamin-api.
# Bearer token only (no basic auth — AI interview has no whitelist-key consumers).
# Returns { user_id:, role:, scheme: } from a verified JWT issued by the shared auth service.
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

    { user: user_struct, claims: }
  end

  private

  attr_reader :headers

  def build_user_struct(claims)
    if claims[:user_id].blank? || claims[:role].blank? || claims[:scheme].blank?
      raise(ExceptionHandler::InvalidToken, 'Required claims are missing')
    end

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
    authorization = headers['Authorization'].to_s
    scheme, token = authorization.split(/\s+/, 2)
    return token if scheme&.casecmp('Bearer')&.zero? && token.present? && !token.match?(/\s/)

    raise(ExceptionHandler::MissingToken, Message.missing_token)
  end
end
