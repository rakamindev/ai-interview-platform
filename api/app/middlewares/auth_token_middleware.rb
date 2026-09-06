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

    result, auth_error = authenticate_request(request)

    if auth_error && @required_roles.any?
      return error(*auth_error)
    end

    Current.user = result[:user] if result

    super
  end

  private

  def authenticate_request(request)
    result = AuthorizeApiRequest.new(request.headers, @required_roles).call
    [result, nil]
  rescue ExceptionHandler::Unauthorized => e
    [nil, [403, e.message]]
  rescue ExceptionHandler::MissingToken, ExceptionHandler::InvalidToken => e
    [nil, [401, e.message]]
  rescue StandardError => _e
    [nil, [401, 'Request not authenticated']]
  end
end
