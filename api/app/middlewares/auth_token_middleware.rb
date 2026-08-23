# frozen_string_literal: true

# Extracted and simplified from rakamin-api.
# Sets Current.user (OpenStruct) from a validated JWT.
# Does NOT look up the user in the database — trusts JWT claims.
#
# Usage in ApplicationController:
#   authorize_auth_token! :admin            # require admin role
#   authorize_auth_token! :assessor         # require assessor or admin
#   authorize_auth_token! :any              # any authenticated user
#   authorize_auth_token!                   # just validate token; no role check
class AuthTokenMiddleware < ApplicationMiddleware
    def initialize(app, *roles)
        super(app)
        @required_roles = roles.flatten.map(&:to_s)
    end

    def call(env)
        request = ActionDispatch::Request.new(env)

        result = capture_error do
            AuthorizeApiRequest.new(request.headers, @required_roles).call
        end

        return error(*@error) if @error && !@required_roles.empty?

        Current.user = result[:user] if result

        super
    end

    private

    def capture_error
        yield
    rescue ExceptionHandler::Unauthorized => e
        @error ||= [403, e.message]
        nil
    rescue ExceptionHandler::MissingToken, ExceptionHandler::InvalidToken => e
        @error ||= [401, e.message]
        nil
    rescue StandardError => _e
        @error ||= [401, 'Request not authenticated']
        nil
    end
end
