# frozen_string_literal: true

module Api
  module V1
    # Handles user authentication and JWT minting for assessors and admins.
    class AuthenticationController < ApiController
      skip_before_action :require_tenant!

      # POST /api/v1/auth/login
      def authenticate
        user = User.find_by(email: params[:email].to_s.downcase)

        return json_error('Invalid email or password', :unauthorized) unless valid_credentials?(user)

        scheme = resolve_scheme(user)
        token  = JsonWebToken.encode({ user_id: user.id, role: user.role, scheme: })

        json_response({ token:, user: { id: user.id, email: user.email, role: user.role } })
      end

      private

      def valid_credentials?(user)
        user&.authenticate(params[:password]) && user.role.in?(%w[admin assessor])
      end

      def resolve_scheme(user)
        user.organization&.scheme || Organization.first&.scheme || 'test-corp'
      end
    end
  end
end
