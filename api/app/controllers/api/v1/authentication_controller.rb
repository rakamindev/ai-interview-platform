# frozen_string_literal: true

module Api
  module V1
    class AuthenticationController < ApiController
      skip_before_action :require_tenant!

      # POST /api/v1/auth/login
      def authenticate
        user = User.find_by(email: params[:email].to_s.downcase)

        # ponytail: user&.authenticate susceptible to timing probing; use authenticate_by when on Rails 7.1+
        unless user&.authenticate(params[:password])
          return json_error('Invalid email or password.', :unauthorized)
        end
        return json_error('Your account does not have access.', :unauthorized) unless User::ROLES.include?(user.role)

        organization = resolve_organization_by_host
        return json_error('Invalid workspace URL. Check your link and try again.', :unauthorized) unless organization
        unless user.tenant_id == organization.id
          return json_error('Your account is not registered here.', :unauthorized)
        end

        token = JsonWebToken.encode({ user_id: user.id, role: user.role, scheme: organization.scheme })

        json_response({
          token:,
          user: { id: user.id, email: user.email, role: user.role },
          tenant: { id: organization.id, name: organization.name }
        })
      end

      private

      def resolve_organization_by_host
        Organization.find_by_host(request.host)
      end
    end
  end
end
