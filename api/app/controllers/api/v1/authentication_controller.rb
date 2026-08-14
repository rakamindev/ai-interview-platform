# frozen_string_literal: true

module Api
  module V1
    class AuthenticationController < ApiController
      skip_before_action :require_tenant!

      # POST /api/v1/auth/login
      def authenticate
        user = User.find_by(email: params[:email].to_s.downcase)

        return json_error('Invalid email or password', :unauthorized) unless user&.authenticate(params[:password])

        return json_error('Invalid email or password', :unauthorized) unless user.role == 'admin'

        scheme = resolve_scheme(user)
        token  = JsonWebToken.encode({ user_id: user.id, role: user.role, scheme: })

        json_response({ token:, user: { id: user.id, email: user.email, role: user.role } })
      end

      private

      # The tenant is derived from the authenticated user's own organization —
      # never from a client-supplied header. This closes the cross-tenant
      # escalation where any admin could mint a token for an arbitrary scheme.
      def resolve_scheme(user)
        org = user.organization
        raise ExceptionHandler::TenantNotFound, 'User has no tenant assigned' unless org

        org.scheme
      end
    end
  end
end
