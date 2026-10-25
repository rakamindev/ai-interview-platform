# frozen_string_literal: true

module Api
  module V1
    class AuthenticationController < ApiController
      skip_before_action :require_tenant!

      # POST /api/v1/auth/login
      #
      # The tenant (`scheme` claim) is derived ONLY from the authenticated user's
      # own membership. Client-supplied values (body params, X-Tenant-Scheme header)
      # are never trusted here: otherwise a user of tenant A could mint a validly
      # signed token for tenant B. There is no fallback tenant — login fails closed.
      def authenticate
        user = User.find_by(email: params[:email].to_s.downcase)

        return json_error('Invalid email or password', :unauthorized) unless user&.authenticate(params[:password])

        return json_error('Invalid email or password', :unauthorized) unless user.role == 'admin'

        organization = tenant_for(user)
        return json_error('User is not assigned to a valid organization', :forbidden) unless organization

        token = JsonWebToken.encode({ user_id: user.id, role: user.role, scheme: organization.scheme })

        json_response({
          token:,
          user: { id: user.id, email: user.email, role: user.role, scheme: organization.scheme },
          tenant: { id: organization.scheme, name: organization.name }
        })
      end

      private

      # Exact match on scheme. Organization.identify is deliberately NOT used because
      # it falls back to the default organization (id 0) for unknown identifiers.
      def tenant_for(user)
        return if user.scheme.blank?

        Organization.find_by(scheme: user.scheme)
      end
    end
  end
end
