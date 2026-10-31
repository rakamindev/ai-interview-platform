# frozen_string_literal: true

module Api
  module V1
    class AuthenticationController < ApiController
      skip_before_action :require_tenant!

      # POST /api/v1/auth/login
      def authenticate
        user = User.find_by(email: params[:email].to_s.downcase)

        unless user&.authenticate(params[:password])
          Rails.logger.warn("[Auth] AUTH_INVALID_CREDENTIALS: email=#{params[:email]}")
          return json_error('Invalid email or password', :unauthorized)
        end

        unless user.role == 'admin'
          Rails.logger.warn("[Auth] AUTH_ROLE_FORBIDDEN: user_id=#{user.id} role=#{user.role}")
          return json_error('Account valid but access denied: admin role required', :forbidden)
        end

        scheme = resolve_scheme
        token  = JsonWebToken.encode({ user_id: user.id, role: user.role, scheme: })

        json_response({ token:, user: { id: user.id, email: user.email, role: user.role } })
      end

      private

      def resolve_scheme
        request.headers['X-Tenant-Scheme'].presence ||
          ActiveRecord::Base.connection.select_value(
            'SELECT scheme FROM organizations LIMIT 1'
          ) || 'test-corp'
      end
    end
  end
end
