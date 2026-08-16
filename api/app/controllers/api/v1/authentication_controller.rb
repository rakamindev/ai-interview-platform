# frozen_string_literal: true

module Api
  module V1
    # Login is the only place a tenant is decided. Everything downstream —
    # TenantResolverMiddleware, TenantScoped, every controller — reads the
    # `scheme` claim back out of the token and trusts it, so whatever is put in
    # here is the isolation boundary for the next three days of that session.
    class AuthenticationController < ApiController
      skip_before_action :require_tenant!

      # POST /api/v1/auth/login
      def authenticate
        user = User.find_by(email: params[:email].to_s.downcase)

        return json_error('Invalid email or password', :unauthorized) unless user&.authenticate(params[:password])

        return json_error('Invalid email or password', :unauthorized) unless user.role == 'admin'

        # Read from the user's own record, never from the request. The caller
        # used to be able to name their tenant with an X-Tenant-Scheme header
        # and be issued a properly signed token for it.
        scheme = user.organization&.scheme

        # A user whose organisation is missing or deleted has no tenant, and
        # there is no safe default — picking one is how this went wrong before.
        # Same message as a bad password: which accounts exist, and whether
        # their org is intact, is not something an anonymous caller learns here.
        return json_error('Invalid email or password', :unauthorized) if scheme.blank?

        token = JsonWebToken.encode({ user_id: user.id, role: user.role, scheme: })

        json_response({ token:, user: { id: user.id, email: user.email, role: user.role } })
      end
    end
  end
end
