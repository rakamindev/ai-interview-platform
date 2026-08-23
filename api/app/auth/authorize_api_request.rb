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

        { user: user_struct, claims: }
    end

    private

    attr_reader :headers

    def build_user_struct(claims)
        OpenStruct.new(
            id: claims[:user_id],
            role: claims[:role].to_s,
            scheme: claims[:scheme].to_s
        )
    end

    def check_role!(user)
        allowed = @required_roles.map(&:to_s)

        # :any means no role restriction
        return if allowed.include?('any')

        # Support logical grouping: :assessor_or_admin
        effective_role = user.role
        if allowed.include?('assessor') && ASSESSOR_ROLES.include?(effective_role)
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
        return headers['Authorization'].split(' ').last if headers['Authorization'].present?

        raise(ExceptionHandler::MissingToken, Message.missing_token)
    end
end
