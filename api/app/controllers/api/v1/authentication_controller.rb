# frozen_string_literal: true

module Api
  module V1
    class AuthenticationController < ApiController
      skip_before_action :require_tenant!
      authorize_auth_token! :any, only: %i[me]

      # POST /api/v1/auth/login
      def authenticate
        user = User.find_by(email: params[:email].to_s.downcase)

        return json_error('Invalid email or password', :unauthorized) unless user&.authenticate(params[:password])

        return json_error('Invalid email or password', :unauthorized) unless user.role == 'admin'

        # Tenant is derived from the user's own organization — never a client header.
        organization = user.organization
        return json_error('Your account is not linked to an organization.', :forbidden) unless organization

        token = JsonWebToken.encode({ user_id: user.id, role: user.role, scheme: organization.scheme })

        json_response({ token:, user: { id: user.id, email: user.email, role: user.role } })
      end

      # POST /api/v1/signup
      def signup
        # Never trust a client-supplied role — public signup creates least-privilege
        # accounts only. Admins are provisioned out-of-band (seed/console).
        user = User.new(email: params[:email].to_s, password: params[:password], role: 'user')

        if user.save
          token = JsonWebToken.encode({ user_id: user.id, role: user.role, scheme: user.organization&.scheme })

          json_response({ token:, user: { id: user.id, email: user.email, role: user.role } }, :created)
        else
          json_error('Signup failed', :unprocessable_entity, details: user.errors.messages)
        end
      end

      # GET /api/v1/me — current assessor identity for the shell header.
      def me
        user = User.find_by(id: Current.user&.id)

        if user
          json_response(user: { id: user.id, email: user.email, role: user.role })
        else
          json_response(user: { id: Current.user&.id, role: Current.user&.role })
        end
      end
    end
  end
end
