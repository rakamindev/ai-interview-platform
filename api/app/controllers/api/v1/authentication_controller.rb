# frozen_string_literal: true

module Api
  module V1
    class AuthenticationController < ApiController
      skip_before_action :require_tenant!
      before_action :authenticate_me!, only: [:me]

      # POST /api/v1/auth/login
      def authenticate
        user = User.find_by(email: params[:email].to_s.downcase)

        return json_error('Invalid email or password', :unauthorized) unless user&.authenticate(params[:password])

        return json_error('Invalid email or password', :unauthorized) unless user.role == 'admin'

        scheme = resolve_scheme
        token  = JsonWebToken.encode({ user_id: user.id, role: user.role, scheme: })

        json_response({ token:, user: { id: user.id, email: user.email, role: user.role } })
      end

      # GET /api/v1/auth/me
      def me
        user = User.find(current_user.id)

        json_response(user: { id: user.id, email: user.email, role: user.role })
      rescue ActiveRecord::RecordNotFound
        json_error('User not found', :unauthorized)
      end

      private

      def authenticate_me!
        authenticate_with_roles!([:any])
      end

      def resolve_scheme
        request.headers['X-Tenant-Scheme'].presence ||
          ActiveRecord::Base.connection.select_value(
            'SELECT scheme FROM organizations LIMIT 1'
          ) || 'test-corp'
      end
    end
  end
end
